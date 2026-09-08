#!/usr/bin/env python3
"""Publish a walkthrough to YouTube with a token the operator authorised once.

No password ever reaches this script. The operator creates an OAuth client in
Google Cloud (a Desktop app client, with the YouTube Data API v3 enabled),
downloads its client secret JSON, and stores it in the macOS keychain. The
first run opens the browser for one consent; the refresh token that comes
back is stored in the keychain too. Every later run reads both from there,
the way scripts/narration reads the ElevenLabs key.

  # once: put the downloaded client secret in the keychain
  security add-generic-password -s YOUTUBE_CLIENT_SECRET -a "$USER" -w "$(cat ~/Downloads/client_secret_*.json)" -U

  # once: consent in the browser, store the refresh token
  python3 scripts/youtube/publish.py auth

  # upload, unlisted by default so it can be reviewed before it is public
  python3 scripts/youtube/publish.py upload media/journeys/onboarding.mp4 \
      --title "Onboarding · Kit Notes" --description-file media/journeys/onboarding.txt

  # flip a reviewed video public
  python3 scripts/youtube/publish.py publish <video_id>

Needs: google-auth-oauthlib and google-api-python-client, in a venv:
  python3 -m venv ~/.kit/venvs/youtube && ~/.kit/venvs/youtube/bin/pip install google-auth-oauthlib google-api-python-client
and run this with ~/.kit/venvs/youtube/bin/python.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube"]
SECRET_SERVICE = "YOUTUBE_CLIENT_SECRET"
TOKEN_SERVICE = "YOUTUBE_REFRESH_TOKEN"


def keychain_get(service: str) -> str | None:
    out = subprocess.run(["security", "find-generic-password", "-s", service, "-w"], capture_output=True, text=True)
    return out.stdout.strip() if out.returncode == 0 and out.stdout.strip() else None


def keychain_set(service: str, value: str) -> None:
    import os
    subprocess.run(["security", "add-generic-password", "-s", service, "-a", os.environ.get("USER", "kit"), "-w", value, "-U"], check=True)


def client_config() -> dict:
    raw = keychain_get(SECRET_SERVICE)
    if not raw:
        sys.exit(f"no client secret in the keychain under {SECRET_SERVICE}; see the header of this file")
    return json.loads(raw)


def credentials():
    from google.oauth2.credentials import Credentials

    raw = keychain_get(TOKEN_SERVICE)
    if not raw:
        sys.exit(f"no token in the keychain under {TOKEN_SERVICE}; run: publish.py auth")
    return Credentials.from_authorized_user_info(json.loads(raw), SCOPES)


def cmd_auth(_: argparse.Namespace) -> None:
    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_config(client_config(), SCOPES)
    creds = flow.run_local_server(port=0, prompt="consent")
    keychain_set(TOKEN_SERVICE, creds.to_json())
    print(f"token stored in the keychain under {TOKEN_SERVICE}")


def service():
    from googleapiclient.discovery import build

    return build("youtube", "v3", credentials=credentials())


def cmd_upload(args: argparse.Namespace) -> None:
    from googleapiclient.http import MediaFileUpload

    video = Path(args.file)
    if not video.exists():
        sys.exit(f"no such file: {video}")
    description = Path(args.description_file).read_text() if args.description_file else (args.description or "")
    body = {
        "snippet": {"title": args.title, "description": description, "categoryId": "28",
                    "tags": [t for t in (args.tags or "").split(",") if t.strip()]},
        "status": {"privacyStatus": args.privacy, "selfDeclaredMadeForKids": False},
    }
    media = MediaFileUpload(str(video), chunksize=8 * 1024 * 1024, resumable=True)
    request = service().videos().insert(part="snippet,status", body=body, media_body=media)
    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"  {int(status.progress() * 100)}%", flush=True)
    vid = response["id"]
    print(f"uploaded {video.name} as {args.privacy}: https://youtu.be/{vid}")


def cmd_publish(args: argparse.Namespace) -> None:
    service().videos().update(part="status", body={"id": args.video_id, "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False}}).execute()
    print(f"public: https://youtu.be/{args.video_id}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Publish Kit's walkthroughs to YouTube with a keychain token.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("auth").set_defaults(fn=cmd_auth)
    up = sub.add_parser("upload")
    up.add_argument("file"); up.add_argument("--title", required=True)
    up.add_argument("--description"); up.add_argument("--description-file")
    up.add_argument("--tags"); up.add_argument("--privacy", default="unlisted", choices=["unlisted", "private", "public"])
    up.set_defaults(fn=cmd_upload)
    pub = sub.add_parser("publish"); pub.add_argument("video_id"); pub.set_defaults(fn=cmd_publish)
    args = ap.parse_args()
    args.fn(args)


if __name__ == "__main__":
    main()
