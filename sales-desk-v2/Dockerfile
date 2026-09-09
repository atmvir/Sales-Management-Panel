FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY style.css /usr/share/nginx/html/style.css
COPY app.js /usr/share/nginx/html/app.js

RUN chmod 644 /usr/share/nginx/html/index.html \
    /usr/share/nginx/html/style.css \
    /usr/share/nginx/html/app.js

EXPOSE 80
