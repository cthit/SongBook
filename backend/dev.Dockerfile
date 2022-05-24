FROM python:3.8-alpine

WORKDIR /usr/src/songbook/backend

#RUN useradd songbook
#RUN chown -R songbook /usr/src/songbook/backend

#USER songbook

ENV SONGBOOK_POSTGRES_USER songbook
ENV SONGBOOK_POSTGRES_PASSWORD password
ENV SONGBOOK_POSTGRES_HOST songbook-db
ENV SONGBOOK_POSTGRES_PORT 5432
ENV PYTHONUNBUFFERED 0

EXPOSE 5000

CMD ["sh", "dev_start.sh"]