#!/bin/zsh
# launchd から毎正時に呼ばれ、引数で渡した名前のショートカットを順に実行する。
# ショートカットは HomePod mini の温度・湿度を読み、Google フォームへ送信する。
#
# 1 回で終わる処理なので、失敗しても次の正時にまた動く。
# 失敗したときは 1 分待って 1 回だけやり直す。それでも駄目なら、
# GAS 側のデータ欠損の Slack 通知で気付ける。

set -u

# 1 回の実行の上限 (秒)。ホームの読み取りに 1 分ほど掛かることがある
limit=300

run_once() {
  local out
  out=$(perl -e 'alarm shift; exec @ARGV' $limit /usr/bin/shortcuts run "$1" 2>&1) || return
  # 終了コードが 0 でもフォームが受け付けたとは限らないので、応答の HTML を見る。
  # 送信完了のページにだけ「別の回答を送信」のリンク (usp=form_confirm) がある
  [[ $out == *usp=form_confirm* ]] || return 3
}

log() {
  print -r -- "$(date '+%Y-%m-%d %H:%M:%S') $*"
}

failed=0
for name in "$@"; do
  for attempt in 1 2; do
    (( attempt > 1 )) && sleep 60
    start=$(date +%s)
    run_once "$name"
    rc=$?
    elapsed=$(( $(date +%s) - start ))
    if (( rc == 0 )); then
      log "ok attempt=$attempt ${elapsed}s $name"
      break
    fi
    # rc=142 は上限の秒数で打ち切ったとき (許可のダイアログ待ちなど)、
    # rc=3 は実行は終わったがフォームの送信完了を確かめられなかったとき
    log "NG attempt=$attempt rc=$rc ${elapsed}s $name" >&2
    (( attempt == 2 )) && failed=1
  done
done
exit $failed
