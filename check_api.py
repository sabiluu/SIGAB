import urllib.request
import json

resp = urllib.request.urlopen('http://127.0.0.1:8000/flood/incidents')
data = json.loads(resp.read().decode())
print("Total:", data.get("total"))
print("Items count:", len(data.get("items", [])))
print("Page:", data.get("page"), "Page size:", data.get("page_size"), "Total pages:", data.get("total_pages"))
for it in data.get("items", []):
    print(f"ID {it['id']}: {it['title']} | Date: {it.get('date')} | Cat: {it.get('category')}")
