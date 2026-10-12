import json
import os
import re
import urllib.request


def main():
    base_url = os.environ.get("AYUVSAATHI_BASE_URL", "http://localhost:3000").rstrip("/")
    accounts_json = os.environ.get("AYUVSAATHI_TEST_ACCOUNTS", "")
    if not accounts_json:
        raise SystemExit(
            "Set AYUVSAATHI_TEST_ACCOUNTS to a JSON array of local test email/password objects."
        )

    try:
        accounts = json.loads(accounts_json)
    except json.JSONDecodeError as error:
        raise SystemExit("AYUVSAATHI_TEST_ACCOUNTS must contain valid JSON.") from error
    if not isinstance(accounts, list) or not accounts:
        raise SystemExit("AYUVSAATHI_TEST_ACCOUNTS must be a non-empty JSON array.")

    for account in accounts:
        if (
            not isinstance(account, dict)
            or not isinstance(account.get("email"), str)
            or not isinstance(account.get("password"), str)
        ):
            raise SystemExit("Each test account must include string email and password fields.")

        email = account["email"]
        request = urllib.request.Request(
            f"{base_url}/api/auth/sign-in",
            data=json.dumps(
                {"email": email, "password": account["password"]}
            ).encode("utf-8"),
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(request) as response:
            cookie = response.headers.get("Set-Cookie", "")
        match = re.search(r"arogya_session=([^;]+)", cookie)
        if not match:
            print(f"FAILED: No session cookie returned for {email}")
            continue

        headers = {"Cookie": f"arogya_session={match.group(1)}"}
        with urllib.request.urlopen(
            urllib.request.Request(f"{base_url}/api/me", headers=headers)
        ) as response:
            user = json.loads(response.read().decode("utf-8"))["user"]
            me_status = response.status
        with urllib.request.urlopen(
            urllib.request.Request(f"{base_url}/api/dashboard", headers=headers)
        ) as response:
            dashboard_status = response.status

        print(
            f"SUCCESS: {email} -> {user.get('displayName')} | "
            f"Me: {me_status} | Dashboard: {dashboard_status}"
        )


if __name__ == "__main__":
    main()
