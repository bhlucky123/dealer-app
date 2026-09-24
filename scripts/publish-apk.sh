#!/usr/bin/env bash
set -euo pipefail
# Invoked only after certificate verification, and only when rollout is enabled.
: "${RELEASE_SSH_KEY:?}" "${RELEASE_KNOWN_HOSTS:?}" "${RELEASE_HOST:?}"
: "${ANDROID_DISTRIBUTED_CERT_SHA256:?}" "${APK_PACKAGE:?}" "${APK_FILE:?}"
[[ "$RELEASE_HOST" =~ ^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+$ ]] || exit 1
[[ "$ANDROID_DISTRIBUTED_CERT_SHA256" =~ ^[a-fA-F0-9]{64}$ ]] || exit 1
case "$APK_PACKAGE" in com.luckybh.calculator|com.luckybh.topadmin) ;; *) exit 1;; esac
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ && "$GITHUB_RUN_ATTEMPT" =~ ^[0-9]+$ ]] || exit 1
task_dir=$(mktemp -d)
trap 'rm -rf -- "$task_dir"' EXIT
printf '%s\n' "$RELEASE_SSH_KEY" > "$task_dir/key"
printf '%s\n' "$RELEASE_KNOWN_HOSTS" > "$task_dir/known_hosts"
chmod 600 "$task_dir/key"
ssh_options=(-i "$task_dir/key" -o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$task_dir/known_hosts")
remote_file="/srv/luckybh/releases/incoming/$APK_PACKAGE-$GITHUB_RUN_ID-$GITHUB_RUN_ATTEMPT.apk"
scp "${ssh_options[@]}" "$APK_FILE" "$RELEASE_HOST:$remote_file"
ssh "${ssh_options[@]}" "$RELEASE_HOST" "/usr/bin/python3 /usr/local/lib/luckybh/publish_apk.py '$remote_file' --package '$APK_PACKAGE' --certificate '$ANDROID_DISTRIBUTED_CERT_SHA256' --root /srv/luckybh/releases --base-url https://alfarah.in"
