#!/usr/bin/env python3
"""
Crawl prompts from https://prompts.sorry.ink/api
Save to JSONL for batch import.

Usage:
  python scripts/crawl-prompts.py --pages 100          # crawl first 100 pages
  python scripts/crawl-prompts.py --all                # crawl all ~680 pages
  python scripts/crawl-prompts.py --resume             # resume from last checkpoint
"""

import argparse
import json
import os
import ssl
import sys
import time
import urllib.request
from pathlib import Path
from urllib.parse import quote

BASE_URL = "https://prompts.sorry.ink/api"
OUTPUT_DIR = Path(__file__).parent.parent / "resources" / "crawled-prompts"
CHECKPOINT_FILE = OUTPUT_DIR / ".checkpoint.json"
PAGE_SIZE = 50
REQUEST_DELAY = 3.0  # seconds between requests (very gentle)

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def api_get(path: str) -> dict:
    url = f"{BASE_URL}{path}"
    req = urllib.request.Request(url, headers={
        "Accept": "application/json",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Referer": "https://prompts.sorry.ink/",
        "Connection": "close",
    })
    with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as resp:
        return json.loads(resp.read().decode("utf-8"))


def load_checkpoint() -> dict:
    if CHECKPOINT_FILE.exists():
        return json.loads(CHECKPOINT_FILE.read_text())
    return {"last_page": 0, "total_fetched": 0}


def save_checkpoint(cp: dict):
    CHECKPOINT_FILE.write_text(json.dumps(cp, indent=2))


def slug_to_path(slug: str) -> str:
    return quote(slug, safe="")


def crawl(args):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "prompts.jsonl"

    checkpoint = load_checkpoint()
    start_page = checkpoint["last_page"] + 1 if args.resume else 1

    if args.pages:
        total_pages = args.pages
    else:
        print("Fetching first page to determine total...")
        first = api_get(f"/prompts?sort=latest&page=1&pageSize={PAGE_SIZE}")
        total_items = first.get("total", 0)
        total_pages = (total_items + PAGE_SIZE - 1) // PAGE_SIZE
        print(f"Total items: {total_items}, Total pages: {total_pages}")

    end_page = min(total_pages, args.max_pages) if args.max_pages else total_pages

    print(f"Crawling pages {start_page} ~ {end_page}, output: {output_file}")

    mode = "a" if args.resume else "w"
    with open(output_file, mode, encoding="utf-8") as f:
        for page in range(start_page, end_page + 1):
            retries = 3
            while retries > 0:
                try:
                    list_data = api_get(f"/prompts?sort=latest&page={page}&pageSize={PAGE_SIZE}")
                    items = list_data.get("items", [])
                    if not items:
                        print(f"Page {page}: no items, stopping.")
                        return

                    for item in items:
                        slug = item["slug"]
                        try:
                            detail = api_get(f"/prompts/{slug_to_path(slug)}")
                            record = {
                                "id": detail["id"],
                                "slug": detail["slug"],
                                "name": detail.get("title", {}).get("zh", "") or detail.get("title", {}).get("en", ""),
                                "category": detail.get("category", {}).get("slug", "custom"),
                                "categoryName": detail.get("category", {}).get("name", {}).get("zh", ""),
                                "prompt": detail.get("prompt", {}).get("zh", "") or detail.get("prompt", {}).get("en", ""),
                                "promptEn": detail.get("prompt", {}).get("en", ""),
                                "negativePrompt": detail.get("negativePrompt", {}).get("zh", "") if detail.get("negativePrompt") else "",
                                "tags": [t["slug"] for t in detail.get("tags", [])],
                                "tagNames": [t.get("name", {}).get("zh", "") for t in detail.get("tags", [])],
                                "coverImage": detail.get("primaryImage", {}).get("remoteUrl") if detail.get("primaryImage") else None,
                                "aspectRatio": detail.get("aspectRatio"),
                                "sourceSite": detail.get("sourceSite"),
                                "sourceUrl": detail.get("sourceUrl"),
                                "viewCount": detail.get("viewCount", 0),
                                "likeCount": detail.get("likeCount", 0),
                                "favoriteCount": detail.get("favoriteCount", 0),
                            }
                            f.write(json.dumps(record, ensure_ascii=False) + "\n")
                            f.flush()
                            os.fsync(f.fileno())
                            checkpoint["total_fetched"] += 1
                            time.sleep(REQUEST_DELAY)
                        except Exception as e:
                            print(f"  Detail error for {slug}: {e}")
                            time.sleep(1)

                    checkpoint["last_page"] = page
                    save_checkpoint(checkpoint)

                    if page % 10 == 0 or page == end_page:
                        print(f"Page {page}/{end_page} done, total fetched: {checkpoint['total_fetched']}")

                    time.sleep(REQUEST_DELAY)
                    break  # success, exit retry loop

                except Exception as e:
                    retries -= 1
                    wait = 5 * (4 - retries)  # 5s, 10s, 15s backoff
                    print(f"Page {page} error ({3 - retries}/3): {e}, waiting {wait}s...")
                    save_checkpoint(checkpoint)
                    time.sleep(wait)
                    if retries == 0:
                        print(f"Page {page} failed after 3 retries, skipping.")

    print(f"Done! Total fetched: {checkpoint['total_fetched']}, saved to {output_file}")


def main():
    parser = argparse.ArgumentParser(description="Crawl prompts from prompts.sorry.ink")
    parser.add_argument("--pages", type=int, help="Number of pages to crawl")
    parser.add_argument("--all", action="store_true", help="Crawl all pages")
    parser.add_argument("--resume", action="store_true", help="Resume from checkpoint")
    parser.add_argument("--max-pages", type=int, default=None, help="Max pages cap")
    args = parser.parse_args()

    if not args.pages and not args.all and not args.resume:
        print("Use --pages N, --all, or --resume")
        sys.exit(1)

    crawl(args)


if __name__ == "__main__":
    main()
