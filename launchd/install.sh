#!/bin/zsh
# launchd の設定を Mac に入れる (入れ直しも同じ)。
#   ローカル:   launchd/install.sh
#   ssh 先:     launchd/install.sh <host>

set -eu

here=${0:A:h}
label=com.delphinus.temp-updater
host=${1:-}

remote() {
  if [[ -n $host ]]; then ssh "$host" "$@"; else zsh -c "$*"; fi
}

copy() {
  if [[ -n $host ]]; then scp -q "$1" "$host:$2"; else cp "$1" "$2"; fi
}

# 実行するショートカットの名前は git の管理外のファイルに置く (個人名を含みうるため)
list=$here/shortcuts.local
if [[ ! -f $list ]]; then
  print -u2 "$list がありません。shortcuts.local.example をコピーして作ってください"
  exit 1
fi
names=()
while IFS= read -r line; do
  [[ -z ${line//[[:space:]]/} || $line == \#* ]] && continue
  names+=("$line")
done < "$list"
if (( ${#names} == 0 )); then
  print -u2 "$list にショートカット名がありません"
  exit 1
fi
strings=
for name in "${names[@]}"; do
  name=${name//&/&amp;}; name=${name//</&lt;}; name=${name//>/&gt;}
  strings+="    <string>$name</string>"$'\n'
done

home=$(remote 'print -r -- $HOME')
remote "mkdir -p ~/.local/libexec/temp-updater ~/Library/LaunchAgents"
copy "$here/run-shortcuts.sh" "$home/.local/libexec/temp-updater/run-shortcuts.sh"

tmp=$(mktemp)
trap 'rm -f $tmp' EXIT
plist=$(<"$here/$label.plist")
plist=${plist//__HOME__/$home}
plist=${plist//    __SHORTCUTS__$'\n'/$strings}
print -r -- "$plist" > "$tmp"
plutil -lint -s "$tmp"
copy "$tmp" "$home/Library/LaunchAgents/$label.plist"

remote "launchctl bootout gui/\$(id -u)/$label 2>/dev/null || true
launchctl bootstrap gui/\$(id -u) ~/Library/LaunchAgents/$label.plist
launchctl print gui/\$(id -u)/$label | grep -E '^\s*(state|path) ='"
