import requests
from bs4 import BeautifulSoup
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")

def scrape_data():
    years = [2024, 2025]
    categories = ['Overall', 'Engineering', 'Innovation']
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    }
    
    os.makedirs(DATA_DIR, exist_ok=True)
    all_success = True
    
    for year in years:
        for category in categories:
            url = f"https://www.nirfindia.org/Rankings/{year}/{category}Ranking.html"
            print(f"Fetching data from {url}...")
            
            try:
                response = requests.get(url, headers=headers)
                response.raise_for_status()

                soup = BeautifulSoup(response.content, 'html.parser')
                table = soup.find('table', id='tbl_overall')
                
                if not table:
                    print(f"Error: Could not find the table with id 'tbl_overall' for {year} {category}")
                    all_success = False
                    continue
                    
                tbody = table.find('tbody')
                rows = tbody.find_all('tr', recursive=False)
                
                data = []
                
                for row in rows:
                    cols = row.find_all('td', recursive=False)
                    # For Innovation or others, sometimes they have rank bands instead of exact ranks
                    # But if they have at least 6 cols we can parse standard format
                    if len(cols) >= 5:
                        institute_id = cols[0].text.strip()
                        name_raw = cols[1].text.strip()
                        name = name_raw.split('\n')[0].strip()
                        city = cols[2].text.strip()
                        state = cols[3].text.strip()
                        
                        if len(cols) >= 6:
                            score = cols[4].text.strip()
                            rank = cols[5].text.strip()
                        else:
                            score = None
                            rank = cols[4].text.strip()
                        
                        data.append({
                            "institute_id": institute_id,
                            "name": name,
                            "city": city,
                            "state": state,
                            "score": float(score) if score and score.replace('.','',1).isdigit() else None,
                            "rank": int(rank) if rank and rank.isdigit() else rank
                        })
                        
                print(f"Successfully parsed {len(data)} institutions for {year} {category}.")
                
                cache_file = os.path.join(DATA_DIR, f"nirf_{year}_{category.lower()}.json")
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(data, f, indent=4)
                    
            except Exception as e:
                print(f"Error scraping {url}: {e}")
                all_success = False

    return all_success

if __name__ == "__main__":
    scrape_data()
