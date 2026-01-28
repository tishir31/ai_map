#!/usr/bin/env python3
"""
Fetch recent tweets from tracked X/Twitter accounts via the syndication API.
Saves results as tweets.json for the AI Map frontend.

Usage:
    python scripts/fetch_tweets.py
"""

import json
import re
import ssl
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
OUTPUT_FILE = REPO_ROOT / "tweets.json"

# Accounts to fetch (synced with DEFAULT_X_ACCOUNTS in index.html)
ACCOUNTS = [
    {"handle": "sama", "name": "Sam Altman"},
    {"handle": "DarioAmodei", "name": "Dario Amodei"},
    {"handle": "karpathy", "name": "Andrej Karpathy"},
    {"handle": "ylecun", "name": "Yann LeCun"},
    {"handle": "demaborish", "name": "Demis Hassabis"},
    {"handle": "elonmusk", "name": "Elon Musk"},
    {"handle": "satikiram", "name": "Satya Nadella"},
    {"handle": "JensenHuang", "name": "Jensen Huang"},
    {"handle": "AravSrinivas", "name": "Aravind Srinivas"},
    {"handle": "fchollet", "name": "François Chollet"},
    {"handle": "swyx", "name": "Shawn Wang"},
    {"handle": "bindureddy", "name": "Bindu Reddy"},
    {"handle": "emaborish", "name": "Emad Mostaque"},
]

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                  "AppleWebKit/537.36 (KHTML, like Gecko) "
                  "Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# SSL context - disable verification for macOS compatibility
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE


def fetch_url(url, timeout=15):
    """Fetch URL content."""
    req = urllib.request.Request(url, headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except Exception:
        return None


def parse_twitter_date(date_str):
    """Parse Twitter's date format into ISO format."""
    try:
        # Format: "Tue Jan 24 20:14:18 +0000 2023"
        dt = datetime.strptime(date_str, "%a %b %d %H:%M:%S %z %Y")
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        return ""


def fetch_via_syndication(handle, name):
    """Fetch tweets via Twitter's syndication embed API."""
    url = f"https://syndication.twitter.com/srv/timeline-profile/screen-name/{handle}"
    html = fetch_url(url, timeout=15)
    if not html:
        return []

    # Extract the __NEXT_DATA__ JSON
    match = re.search(
        r'<script id="__NEXT_DATA__" type="application/json">(.*?)</script>',
        html, re.DOTALL
    )
    if not match:
        return []

    try:
        data = json.loads(match.group(1))
    except json.JSONDecodeError:
        return []

    # Navigate to the timeline entries
    timeline = (
        data.get("props", {})
        .get("pageProps", {})
        .get("timeline", {})
        .get("entries", [])
    )

    tweets = []
    for entry in timeline:
        if entry.get("type") != "tweet":
            continue

        tweet_data = entry.get("content", {}).get("tweet", {})
        if not tweet_data:
            continue

        tweet_id = tweet_data.get("id_str", "")
        text = tweet_data.get("full_text", "") or tweet_data.get("text", "")
        created_at = tweet_data.get("created_at", "")

        # Skip retweets
        if text.startswith("RT @"):
            continue

        # Get user info from the tweet
        user = tweet_data.get("user", {})
        tweet_handle = user.get("screen_name", handle)
        tweet_name = user.get("name", name)
        avatar = user.get("profile_image_url_https", "")
        # Get higher res avatar
        avatar = avatar.replace("_normal.", "_200x200.") if avatar else ""

        # Get engagement metrics
        likes = tweet_data.get("favorite_count", 0)
        retweets = tweet_data.get("retweet_count", 0)
        replies = tweet_data.get("reply_count", 0)

        # Extract media
        media = []
        entities = tweet_data.get("entities", {})
        extended = tweet_data.get("extended_entities", {})
        media_list = extended.get("media", []) or entities.get("media", [])
        for m in media_list:
            if m.get("type") == "photo":
                media.append({
                    "type": "photo",
                    "url": m.get("media_url_https", ""),
                })

        # Clean text - remove t.co URLs for media
        for m in media_list:
            tco = m.get("url", "")
            if tco:
                text = text.replace(tco, "").strip()

        # Expand shortened URLs in text
        for u in entities.get("urls", []):
            short = u.get("url", "")
            expanded = u.get("expanded_url", "") or u.get("display_url", "")
            if short and expanded:
                text = text.replace(short, expanded)

        if text and len(text.strip()) > 5 and tweet_id:
            tweets.append({
                "id": tweet_id,
                "handle": tweet_handle,
                "name": tweet_name,
                "avatar": avatar,
                "text": text.strip()[:500],
                "url": f"https://x.com/{tweet_handle}/status/{tweet_id}",
                "timestamp": parse_twitter_date(created_at),
                "likes": likes,
                "retweets": retweets,
                "replies": replies,
                "media": media[:2],  # Max 2 media items
            })

    return tweets[:8]  # Max 8 tweets per account


def load_existing():
    """Load existing tweets.json if present."""
    if OUTPUT_FILE.exists():
        try:
            with open(OUTPUT_FILE) as f:
                data = json.load(f)
                return data if isinstance(data, dict) else {"tweets": [], "updated": ""}
        except Exception:
            pass
    return {"tweets": [], "updated": ""}


def main():
    print("=" * 50)
    print("AI Map Tweet Fetcher (Syndication API)")
    print("=" * 50)

    existing = load_existing()
    all_tweets = []
    success_count = 0

    for account in ACCOUNTS:
        handle, name = account["handle"], account["name"]
        print(f"\nFetching @{handle}...")

        tweets = fetch_via_syndication(handle, name)
        if tweets:
            print(f"  Got {len(tweets)} tweets")
            success_count += 1
            all_tweets.extend(tweets)
        else:
            print(f"  No tweets fetched")

        time.sleep(3)  # Rate limiting - syndication API is strict

    # Merge: keep existing tweets for accounts we failed to fetch
    if all_tweets:
        fetched_handles = {t["handle"] for t in all_tweets}
        for t in existing.get("tweets", []):
            if t["handle"] not in fetched_handles:
                all_tweets.append(t)

    # If we got nothing new, keep existing
    if not all_tweets:
        all_tweets = existing.get("tweets", [])

    # Sort by timestamp (newest first), deduplicate
    all_tweets.sort(key=lambda t: t.get("timestamp", ""), reverse=True)

    seen_ids = set()
    deduped = []
    for t in all_tweets:
        if t["id"] not in seen_ids:
            seen_ids.add(t["id"])
            deduped.append(t)

    # Keep max 150 tweets
    deduped = deduped[:150]

    output = {
        "tweets": deduped,
        "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "accounts": len(ACCOUNTS),
        "successful_fetches": success_count,
    }

    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 50}")
    print(f"Done: {len(deduped)} tweets from {success_count}/{len(ACCOUNTS)} accounts")
    print(f"Saved to: {OUTPUT_FILE}")
    print(f"{'=' * 50}")


if __name__ == "__main__":
    main()
