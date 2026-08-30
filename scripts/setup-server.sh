#!/usr/bin/env sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
  echo "Run this script as the normal deployment user, not root." >&2
  exit 1
fi

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/authorized_keys.judges" >&2
  echo "Only run this optional helper when you intentionally grant collaborators SSH access." >&2
  exit 1
fi

KEY_FILE=$1

if [ ! -f "$KEY_FILE" ]; then
  echo "Key file not found: $KEY_FILE" >&2
  exit 1
fi

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"
touch "$HOME/.ssh/authorized_keys"

while IFS= read -r key; do
  case "$key" in
    ""|\#*) continue ;;
    ssh-ed25519\ *|ssh-rsa\ *) ;;
    *)
      echo "Unsupported public-key line in $KEY_FILE" >&2
      exit 1
      ;;
  esac
  grep -Fqx "$key" "$HOME/.ssh/authorized_keys" || printf '%s\n' "$key" >> "$HOME/.ssh/authorized_keys"
done < "$KEY_FILE"

chmod 600 "$HOME/.ssh/authorized_keys"
echo "Judge SSH keys installed for $(id -un)."
