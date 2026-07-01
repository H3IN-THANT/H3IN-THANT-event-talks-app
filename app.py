import os
import re
import json
import logging
from datetime import datetime
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request
from bs4 import BeautifulSoup

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = "releases_cache.json"

def clean_html_content(html):
    """
    Cleans up redundant tags or formats if necessary.
    """
    if not html:
        return ""
    # Standardize links to open in a new tab
    soup = BeautifulSoup(html, 'html.parser')
    for a in soup.find_all('a'):
        a['target'] = '_blank'
        a['rel'] = 'noopener noreferrer'
    return str(soup)

def parse_xml_feed(xml_content):
    """
    Parses the Atom XML feed and splits entry updates by heading tags.
    """
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as e:
        logger.error(f"XML Parsing Error: {e}")
        return []

    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    all_updates = []
    
    entries = root.findall('atom:entry', ns)
    for index, entry in enumerate(entries):
        # Extract title (which is usually the date like "June 30, 2026")
        title_el = entry.find('atom:title', ns)
        date_str = title_el.text if title_el is not None else "Unknown Date"
        
        # Extract updated timestamp
        updated_el = entry.find('atom:updated', ns)
        updated_val = updated_el.text if updated_el is not None else ""
        
        # Parse timestamp to clean ISO format if possible
        formatted_date = date_str
        if updated_val:
            try:
                # e.g., "2026-06-30T00:00:00-07:00"
                dt = datetime.fromisoformat(updated_val)
                # Keep date_str as primary, but we can store raw timestamp for sorting
                timestamp = dt.timestamp()
            except ValueError:
                timestamp = float(len(entries) - index) # fallback sorting
        else:
            timestamp = float(len(entries) - index)
            
        # Extract Link (alternate link)
        link_el = entry.find("atom:link[@rel='alternate']", ns)
        if link_el is None:
            link_el = entry.find('atom:link', ns)
        
        base_link = "https://docs.cloud.google.com/bigquery/docs/release-notes"
        if link_el is not None:
            base_link = link_el.attrib.get('href', base_link)
            
        # Extract Content
        content_el = entry.find('atom:content', ns)
        content_html = content_el.text if content_el is not None else ""
        
        if not content_html:
            continue
            
        # Parse content html and split by `h3` tags (Feature, Change, etc.)
        soup = BeautifulSoup(content_html, 'html.parser')
        current_type = None
        current_content = []
        
        # Unique ID generator helper
        sub_idx = 0
        
        def add_update(u_type, u_content):
            nonlocal sub_idx
            if not u_content:
                return
            cleaned = clean_html_content(''.join(str(e) for e in u_content).strip())
            if not cleaned:
                return
                
            entry_id = f"{date_str.replace(' ', '_').replace(',', '')}_{u_type}_{sub_idx}"
            sub_idx += 1
            
            all_updates.append({
                'id': entry_id,
                'date': date_str,
                'timestamp': timestamp,
                'type': u_type or 'Update',
                'content': cleaned,
                'link': f"{base_link}#{date_str.replace(' ', '_').replace(',', '')}"
            })

        for el in soup.contents:
            if el.name == 'h3':
                if current_type is not None:
                    add_update(current_type, current_content)
                    current_content = []
                current_type = el.text.strip()
            else:
                if current_type is not None:
                    current_content.append(el)
                else:
                    # In case there's content before any h3, gather it
                    current_content.append(el)
                    
        # Add the last block
        if current_type is not None or current_content:
            add_update(current_type or 'Update', current_content)
            
    # Sort updates by timestamp descending
    all_updates.sort(key=lambda x: x['timestamp'], reverse=True)
    return all_updates

def fetch_and_cache_releases(force=False):
    """
    Fetches the releases feed and caches it. Returns parsed JSON data.
    """
    if not force and os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                cached_data = json.load(f)
                logger.info("Serving from cache.")
                return cached_data
        except Exception as e:
            logger.error(f"Error reading cache: {e}")

    logger.info("Fetching fresh release notes from Google Cloud...")
    try:
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        xml_content = response.content
        
        updates = parse_xml_feed(xml_content)
        
        # Save cache
        cache_data = {
            'last_updated': datetime.now().isoformat(),
            'updates': updates
        }
        with open(CACHE_FILE, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
        return cache_data
    except Exception as e:
        logger.error(f"Error fetching feed: {e}")
        # If fetch failed but we have cache, fallback to cache
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception:
                pass
        return {
            'last_updated': None,
            'updates': [],
            'error': f"Failed to load release notes: {str(e)}"
        }

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/releases')
def get_releases():
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    data = fetch_and_cache_releases(force=force_refresh)
    return jsonify(data)

if __name__ == '__main__':
    # Bind to all interfaces (useful for testing or dockerizing)
    app.run(debug=True, port=5000)
