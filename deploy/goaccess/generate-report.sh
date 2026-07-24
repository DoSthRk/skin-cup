#!/bin/sh
set -eu

umask 027
export LANG=zh_CN.UTF-8
export LC_ALL=zh_CN.UTF-8

log_file=/var/log/nginx/valorant-cup.access.log
report_dir=/var/www/valorant-cup-analytics
temporary_report="$report_dir/.index.$$.html"

cleanup() {
    rm -f -- "$temporary_report"
}

trap cleanup EXIT HUP INT TERM

{
    for archived_log in "$log_file".*.gz; do
        if [ -r "$archived_log" ]; then
            gzip -cd -- "$archived_log"
        fi
    done

    if [ -r "$log_file.1" ]; then
        cat -- "$log_file.1"
    fi

    cat -- "$log_file"
} | /usr/bin/goaccess - \
    --no-global-config \
    --log-format=COMBINED \
    --ignore-crawlers \
    --html-report-title="VALORANT-CUP 流量统计" \
    --output="$temporary_report"

chmod 0640 "$temporary_report"
mv -f -- "$temporary_report" "$report_dir/index.html"
trap - EXIT HUP INT TERM
