import os
import json
import urllib.request

env_path = os.path.abspath("backend/.env")
env_vars = {}
with open(env_path, "r", encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            env_vars[k.strip()] = v.strip().strip('"').strip("'")

supabase_url = env_vars.get("SUPABASE_URL")
service_key = env_vars.get("SUPABASE_SERVICE_ROLE_KEY")

headers = {
    "apikey": service_key,
    "Authorization": f"Bearer {service_key}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

# 1. Fetch all auth users
print("[Sync] Fetching all auth.users...")
req_users = urllib.request.Request(f"{supabase_url}/auth/v1/admin/users", headers=headers)
with urllib.request.urlopen(req_users) as res:
    users_data = json.loads(res.read().decode())
    users = users_data.get("users", [])

print(f"[Sync] Found {len(users)} auth users")

for u in users:
    uid = u["id"]
    meta = u.get("user_metadata", {}) or {}
    email = u.get("email", "")
    
    full_name = meta.get("full_name") or meta.get("name") or None
    username = meta.get("username")
    avatar_url = meta.get("avatar_url") or meta.get("picture") or None

    if not username or len(username) < 3:
        username = "user_" + uid.replace("-", "")[:10]

    print(f"\n[Sync] Processing user {email} ({uid}):")
    print(f"       full_name={full_name}, username={username}")

    # Check if profile exists
    check_req = urllib.request.Request(f"{supabase_url}/rest/v1/profiles?id=eq.{uid}&select=id,username,full_name", headers=headers)
    with urllib.request.urlopen(check_req) as c_res:
        existing = json.loads(c_res.read().decode())

    if existing:
        prof = existing[0]
        print(f"       Profile already exists: username='{prof.get('username')}', full_name='{prof.get('full_name')}'")
        # If existing profile has null full_name or generic username, but metadata has real value, repair it!
        updates = {}
        if not prof.get("full_name") and full_name:
            updates["full_name"] = full_name
        if meta.get("username") and prof.get("username") != meta.get("username"):
            updates["username"] = meta.get("username").lower().strip()
        if updates:
            print(f"       Updating profile with actual metadata: {updates}")
            p_data = json.dumps(updates).encode("utf-8")
            p_req = urllib.request.Request(f"{supabase_url}/rest/v1/profiles?id=eq.{uid}", data=p_data, headers=headers, method="PATCH")
            with urllib.request.urlopen(p_req) as up_res:
                print(f"       Updated profile: HTTP {up_res.status}")
    else:
        print(f"       Creating MISSING profile: username='{username}', full_name='{full_name}'")
        profile_payload = {
            "id": uid,
            "username": username.lower().strip(),
            "full_name": full_name,
            "avatar_url": avatar_url,
            "bio": ""
        }
        p_data = json.dumps(profile_payload).encode("utf-8")
        p_req = urllib.request.Request(f"{supabase_url}/rest/v1/profiles", data=p_data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(p_req) as p_res:
                print(f"       Created profile: HTTP {p_res.status}")
        except Exception as e:
            print(f"       ERROR creating profile: {e}")

    # Ensure user_preferences row exists
    pref_check = urllib.request.Request(f"{supabase_url}/rest/v1/user_preferences?user_id=eq.{uid}&select=user_id", headers=headers)
    with urllib.request.urlopen(pref_check) as pref_res:
        pref_existing = json.loads(pref_res.read().decode())
    
    if not pref_existing:
        print(f"       Creating default preferences for {uid}...")
        pref_payload = {
            "user_id": uid,
            "preferred_tags": [],
            "onboarding_completed": False,
            "settings": {}
        }
        pr_data = json.dumps(pref_payload).encode("utf-8")
        pr_req = urllib.request.Request(f"{supabase_url}/rest/v1/user_preferences", data=pr_data, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(pr_req) as pr_res:
                print(f"       Created user_preferences: HTTP {pr_res.status}")
        except Exception as e:
            print(f"       ERROR creating user_preferences: {e}")

print("\n[Sync] Done synchronizing profiles.")

