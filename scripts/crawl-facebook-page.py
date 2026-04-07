"""
Facebook Page post crawler using Playwright.
Scrolls the page, extracts post content, outputs JSON dataset.

Usage:
    python3 scripts/crawl-facebook-page.py --url <facebook_page_url> --output <output.json> [--max-posts 50] [--headless]

Example:
    python3 scripts/crawl-facebook-page.py \
        --url https://www.facebook.com/FUTALand \
        --output dataset/facebook/futaland.json \
        --max-posts 50
"""

import argparse
import json
import re
import time
from datetime import date

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError


# ── Helpers ──────────────────────────────────────────────────────────────────

def extract_hashtags(text: str) -> list[str]:
    return re.findall(r'#(\w+)', text)


def extract_title(text: str) -> str:
    """Return first non-empty, non-emoji-only line as title."""
    for line in text.split('\n'):
        clean = line.strip()
        # Strip leading/trailing emojis and symbols
        clean = re.sub(r'^[\U0001F300-\U0001FFFF\u2600-\u26FF\u2700-\u27BF\s]+', '', clean).strip()
        clean = re.sub(r'[\U0001F300-\U0001FFFF\u2600-\u26FF\u2700-\u27BF\s]+$', '', clean).strip()
        if len(clean) > 10:
            return clean[:150]
    return text.split('\n')[0].strip()[:150]


def extract_summary(text: str) -> str:
    """Return first 2-3 meaningful body lines joined."""
    lines = [l.strip() for l in text.split('\n') if l.strip() and not l.startswith('#')]
    body = []
    for line in lines[1:4]:
        cleaned = re.sub(r'^[\U0001F300-\U0001FFFF\u2600-\u26FF\u2700-\u27BF\s▶️🔰👉📣💥]+\s*', '', line).strip()
        if cleaned:
            body.append(cleaned)
    return ' '.join(body)[:350]


def detect_subtype(text: str) -> str:
    """Classify post into sub-type based on keywords."""
    t = text.lower()
    if any(k in t for k in ['booking', 'mở bán', 'giỏ hàng', 'giai đoạn']):
        return 'sales_opening'
    if any(k in t for k in ['ký kết', 'hợp tác', 'đại lý', 'phân phối']):
        return 'partnership_news'
    if any(k in t for k in ['8/3', 'phụ nữ', 'womens', 'tết', 'xuân']):
        return 'holiday_greeting'
    if any(k in t for k in ['chính sách', 'vay', 'hỗ trợ tài chính', 'hđmb']):
        return 'financial_policy'
    if any(k in t for k in ['quy hoạch', 'hạ tầng', 'xu hướng', 'thị trường']):
        return 'market_insight'
    if any(k in t for k in ['coming soon', 'sắp ra mắt', 'lộ diện', 'hé lộ']):
        return 'teaser'
    if any(k in t for k in ['tiến độ', 'công trường', 'cập nhật']):
        return 'construction_update'
    return 'project_news'


def clean_post_text(text: str) -> str:
    """Remove trailing 'Xem thêm' / '...' artifacts from Facebook truncation."""
    text = re.sub(r'\s*\n?…\s*\nXem thêm.*$', '', text, flags=re.DOTALL).strip()
    text = re.sub(r'\s*Xem thêm\s*$', '', text, flags=re.DOTALL).strip()
    return text


def is_usable(text: str) -> bool:
    """Filter out truncated or too-short posts."""
    if len(text) < 100:
        return False
    # Still truncated after cleaning
    if text.endswith('…') or text.endswith('Xem thêm'):
        return False
    return True


def slug_from_url(url: str) -> str:
    """Derive a dataset id prefix from the page URL.

    Handles formats:
      - facebook.com/FUTALand
      - facebook.com/people/FUTA-Land/61582849838510/
    """
    # /people/<Name>/<id>/ → use the name segment
    people = re.search(r'facebook\.com/people/([^/?]+)', url)
    if people:
        return people.group(1).lower().replace('-', '').replace('_', '')
    # standard /pagename/
    match = re.search(r'facebook\.com/([^/?]+)', url)
    if match:
        return match.group(1).lower().replace('.', '-').replace('_', '-')
    return 'fb-page'


# ── Crawler ───────────────────────────────────────────────────────────────────

def crawl(page_url: str, max_posts: int, headless: bool) -> list[dict]:
    """Launch browser, scroll Facebook page, extract post texts."""
    posts_seen: set[str] = set()
    records: list[dict] = []
    id_prefix = slug_from_url(page_url)
    today = date.today().isoformat()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            # Spoof a realistic desktop browser to avoid bot detection
            user_agent=(
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
                'AppleWebKit/537.36 (KHTML, like Gecko) '
                'Chrome/124.0.0.0 Safari/537.36'
            ),
            viewport={'width': 1280, 'height': 900},
            locale='vi-VN',
        )
        page = context.new_page()

        print(f'[+] Opening {page_url}')
        page.goto(page_url, wait_until='domcontentloaded', timeout=30000)

        # ── Manual login window ───────────────────────────────────────────────
        # Give user time to log in if Facebook shows a login wall.
        # Press Enter in this terminal when you're ready to start crawling.
        print()
        print('=' * 60)
        print('  Browser is open. Log in to Facebook if needed.')
        print('  Navigate to the target page if redirected.')
        print('  When you are READY, press Enter here to start crawling...')
        print('=' * 60)
        input()
        print('[+] Starting crawl...')

        # ── Debug: dump page HTML snapshot to inspect selectors ──────────────
        import os
        if os.environ.get('FB_DEBUG'):
            time.sleep(2)
            html = page.content()
            with open('/tmp/fb-debug.html', 'w', encoding='utf-8') as f:
                f.write(html)
            print('[DEBUG] HTML saved to /tmp/fb-debug.html')

            # Try common Facebook post text selectors and report counts
            debug_selectors = [
                '[data-ad-preview="message"]',
                '[data-ad-comet-preview="message"]',
                'div[dir="auto"]',
                '[class*="userContent"]',
                'div[class*="story_body"]',
                'div[data-testid="post_message"]',
                'div[class*="xdj266r"]',   # common FB text class
            ]
            print('\n[DEBUG] Selector probe:')
            for sel in debug_selectors:
                try:
                    count = page.eval_on_selector_all(sel, 'els => els.length')
                    texts = page.eval_on_selector_all(sel, 'els => els.slice(0,2).map(e => e.innerText.slice(0,80))')
                    print(f'  {sel}: {count} elements')
                    for t in texts:
                        if t.strip():
                            print(f'    → {t.strip()[:80]}')
                except Exception as e:
                    print(f'  {sel}: ERROR {e}')
            print()
            input('[DEBUG] Inspect above, then press Enter to continue crawl...')

        scroll_attempts = 0
        max_scrolls = max_posts * 3  # generous scroll budget
        no_new_count = 0  # consecutive scrolls with no new posts found

        while len(records) < max_posts and scroll_attempts < max_scrolls:
            # Wait for page to stabilise before querying (prevents destroyed context)
            try:
                page.wait_for_load_state('domcontentloaded', timeout=5000)
            except Exception:
                pass

            # Click all "Xem thêm" / "See more" expand buttons to get full post text
            try:
                page.eval_on_selector_all(
                    '[data-ad-preview="message"] [role="button"]',
                    '''els => els.forEach(el => {
                        const t = el.innerText.trim();
                        if (t === "Xem thêm" || t === "See more") el.click();
                    })''',
                )
                time.sleep(0.5)  # brief pause for expanded content to render
            except Exception:
                pass

            # Snapshot inner text of all visible post elements safely
            # NOTE: Facebook uses data-ad-preview="message" (not data-ad-comet-preview)
            try:
                texts = page.eval_on_selector_all(
                    '[data-ad-preview="message"]',
                    # Return text of each element in one JS call — avoids
                    # per-element handle queries that break on navigation
                    'els => els.map(el => el.innerText)',
                )
            except Exception as e:
                print(f'  [!] eval error (page navigating?): {e}')
                time.sleep(2)
                scroll_attempts += 1
                continue

            new_this_round = 0
            for raw in texts:
                text = clean_post_text(raw)
                key = text[:120]
                if key in posts_seen or not is_usable(text):
                    continue

                posts_seen.add(key)
                new_this_round += 1
                idx = len(records) + 1
                records.append({
                    "id": f"{id_prefix}-{str(idx).zfill(3)}",
                    "style": "facebook_post",
                    "sub_type": detect_subtype(text),
                    "title": extract_title(text),
                    "summary": extract_summary(text),
                    "content": text,
                    "hashtags": extract_hashtags(text),
                    "crawled_at": today,
                })
                print(f'  [{idx}] {records[-1]["title"][:70]}')

                if len(records) >= max_posts:
                    break

            # Stop early if nothing new for 3 consecutive scrolls
            if new_this_round == 0:
                no_new_count += 1
                if no_new_count >= 3:
                    print('[*] No new posts found for 3 scrolls, stopping.')
                    break
            else:
                no_new_count = 0

            # Scroll down to load more posts
            page.evaluate('window.scrollBy(0, window.innerHeight * 2)')
            time.sleep(2)
            scroll_attempts += 1

        browser.close()

    return records


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description='Crawl Facebook Page posts with Playwright')
    parser.add_argument('--url', required=True, help='Facebook Page URL')
    parser.add_argument('--output', required=True, help='Output JSON file path')
    parser.add_argument('--max-posts', type=int, default=50, help='Max posts to collect (default: 50)')
    parser.add_argument('--headless', action='store_true', default=False,
                        help='Run browser in headless mode (default: False, shows browser)')
    args = parser.parse_args()

    print(f'[*] Crawling up to {args.max_posts} posts from {args.url}')
    records = crawl(args.url, args.max_posts, args.headless)

    import os
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)

    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(records, f, ensure_ascii=False, indent=2)

    print(f'\n[✓] Saved {len(records)} records → {args.output}')


if __name__ == '__main__':
    main()
