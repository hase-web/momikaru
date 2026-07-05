#!/usr/bin/env python3
"""配信ドライランのローカル近似（スプレッドシート公開CSV + マスタ照合）。PDF有無はDrive未確認。"""
import csv
import io
import re
import urllib.parse
import urllib.request
from collections import defaultdict
from datetime import date

SS_ID = "1e-QNTFdqoMK5dRIJ6Je4u7BhPRMDEFAbelzAFLyaTm8"
TARGET_YM = "202606"  # 2026年7月実行時の前月


def fetch_csv(sheet_name):
    url = f"https://docs.google.com/spreadsheets/d/{SS_ID}/gviz/tq?tqx=out:csv&sheet={urllib.parse.quote(sheet_name)}"
    with urllib.request.urlopen(url, timeout=60) as r:
        return list(csv.DictReader(io.StringIO(r.read().decode("utf-8"))))


def norm_id(v):
    s = str(v or "").strip()
    if not s or s == "NULL":
        return ""
    if re.fullmatch(r"\d+\.0+", s):
        s = s.split(".")[0]
    return s


def valid_email(e):
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", str(e or "").strip()))


def norm_channel(raw):
    s = str(raw or "").strip()
    if not s:
        return "LINE"
    if s in ("両方", "LINE+メール", "LINE＋メール"):
        return "LINE+メール"
    return s


def main():
    shopm = fetch_csv("shopm")
    userm = {norm_id(r["id"]): r for r in fetch_csv("userm")}
    uxs = fetch_csv("userxshop")
    try:
        line_link = fetch_csv("line_link")
    except Exception:
        line_link = []
    try:
        folder_map_rows = fetch_csv("店舗フォルダマッピング")
    except Exception:
        folder_map_rows = []

    shop_by_id = {}
    shops = []
    for r in shopm:
        name = str(r.get("name") or "").strip()
        kn = str(r.get("kintoneShopName") or "").strip()
        if not name or not kn:
            continue
        sid = norm_id(r.get("id"))
        shop = {
            "shopId": sid,
            "name": name,
            "kintoneShopName": kn,
            "mail": str(r.get("mail") or "").strip().lower(),
            "startDate": r.get("startDate", ""),
            "endDate": r.get("endDate", ""),
        }
        shops.append(shop)
        if sid:
            shop_by_id[sid] = shop

    # owner emails by shop id (adminLevel 21, userStop 0)
    owner_emails = defaultdict(list)
    owner_uids = defaultdict(list)
    for link in uxs:
        sid = norm_id(link.get("shopId"))
        uid = norm_id(link.get("userId"))
        u = userm.get(uid)
        if not sid or not u:
            continue
        if norm_id(u.get("userStop")) != "0":
            continue
        if norm_id(u.get("adminLevel")) != "21":
            continue
        mail = str(u.get("mail") or "").strip().lower()
        if valid_email(mail) and mail not in owner_emails[sid]:
            owner_emails[sid].append(mail)
        if uid not in owner_uids[sid]:
            owner_uids[sid].append(uid)

    line_by_uid = defaultdict(list)
    for row in line_link:
        uid = norm_id(row.get("userm_id") or row.get("userId"))
        lid = str(row.get("lineUserId") or "").strip()
        status = str(row.get("状態") or row.get("status") or "").strip()
        if not uid or not lid:
            continue
        if status in ("無効", "停止", "inactive"):
            continue
        if lid not in line_by_uid[uid]:
            line_by_uid[uid].append(lid)

    folder_map = {}
    for r in folder_map_rows:
        kn = str(r.get("kintoneShopName") or "").strip()
        if kn:
            folder_map[kn] = r

    summary = {
        "ready": 0,
        "via_line": 0,
        "via_mail_fb": 0,
        "via_mail_only": 0,
        "via_both": 0,
        "pending": 0,
        "blocked": 0,
        "no_folder": 0,
    }
    rows_out = []

    for shop in shops:
        if "出張もみかる" in shop["name"]:
            continue

        kn = shop["kintoneShopName"]
        mapping = folder_map.get(kn, {})
        ch_raw = mapping.get("配信方法", "")
        ch = norm_channel(ch_raw)
        use_line = ch in ("LINE", "LINE+メール", "LINEのみ", "両方")
        use_mail = ch in ("メール", "LINE+メール", "両方")
        fallback = ch == "LINE"

        emails = list(owner_emails.get(shop["shopId"], []))
        if not emails and valid_email(shop["mail"]):
            emails = [shop["mail"]]

        line_ids = []
        for uid in owner_uids.get(shop["shopId"], []):
            for lid in line_by_uid.get(uid, []):
                if lid not in line_ids:
                    line_ids.append(lid)

        folder_id = str(mapping.get("DriveフォルダID(任意)") or mapping.get("DriveフォルダID") or "").strip()
        has_folder = bool(folder_id)

        can_line = use_line and bool(line_ids)
        can_mail = use_mail and bool(emails)
        mail_fb = False
        if not can_mail and fallback and not can_line and emails:
            can_mail = True
            mail_fb = True

        if not has_folder:
            status = "不可"
            note = "店舗フォルダIDなし"
            predicted = ""
            summary["blocked"] += 1
            summary["no_folder"] += 1
        elif not can_line and not can_mail:
            status = "不可"
            if use_line and not line_ids and not fallback:
                note = "LINE未登録（LINEのみ）"
            elif use_line and not line_ids and fallback and not emails:
                note = "LINE未登録かつメールなし"
            elif use_mail and not emails:
                note = "オーナーメールなし"
            else:
                note = "送信先なし"
            predicted = ""
            summary["blocked"] += 1
        else:
            status = "配信可(PDF要GAS確認)"
            note = "月次+顧客分析PDFはDrive未確認"
            summary["ready"] += 1
            summary["pending"] += 1
            if can_line and can_mail and use_mail:
                predicted = "LINE+メール"
                summary["via_both"] += 1
            elif can_line and ch == "LINE+メール" and not can_mail:
                predicted = "LINEのみ（メール未登録）"
                summary["via_line"] += 1
            elif can_line:
                predicted = "LINE"
                summary["via_line"] += 1
            elif can_mail and mail_fb:
                predicted = "メール(フォールバック)"
                summary["via_mail_fb"] += 1
            elif can_mail:
                predicted = "メール"
                summary["via_mail_only"] += 1

        rows_out.append(
            {
                "kintoneShopName": kn,
                "name": shop["name"],
                "channel": ch_raw or "LINE(デフォルト)",
                "predicted": predicted,
                "line": len(line_ids),
                "emails": ", ".join(emails),
                "status": status,
                "note": note,
            }
        )

    print(f"=== 配信ドライラン（ローカル近似）対象月: 2026年6月 ===")
    print(f"対象店舗数: {len(rows_out)}")
    print(f"配信可(送信先OK・PDF未確認): {summary['ready']}")
    print(f"  LINE: {summary['via_line']} / メールFB: {summary['via_mail_fb']} / メールのみ: {summary['via_mail_only']} / 両方: {summary['via_both']}")
    print(f"不可: {summary['blocked']} (うちフォルダIDなし: {summary['no_folder']})")
    print()
    blocked = [r for r in rows_out if r["status"] == "不可"]
    if blocked:
        print("--- 不可店舗（先頭20件）---")
        for r in blocked[:20]:
            print(f"  {r['kintoneShopName']}: {r['note']}")
        if len(blocked) > 20:
            print(f"  ...他 {len(blocked)-20} 店")
    print()
    print("※ PDF揃い確認はGASの testDryRunDelivery が必要です")


if __name__ == "__main__":
    main()
