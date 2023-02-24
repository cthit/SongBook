wait_for_postgres() {
    first_iteration=true
    while ! pg_isready -h "$SONGBOOK_POSTGRES_HOST" -p "$SONGBOOK_POSTGRES_PORT" -q; do
        if [ -n "$first_iteration" ]; then
            printf "Waiting for db \"postgresql://%s@%s:%s\"" "$SONGBOOK_POSTGRES_USER" "$SONGBOOK_POSTGRES_HOST" "$SONGBOOK_POSTGRES_PORT"
            unset first_iteration
        else
            printf "."
        fi

        sleep 1
    done
    if [ -z "$first_iteration" ]; then echo; fi
}

wait_for_postgres
python -u src/app.py