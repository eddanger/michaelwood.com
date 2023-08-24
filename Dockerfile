FROM alpine:latest

RUN apk update
RUN apk add nginx

RUN adduser -D -g 'www' www

RUN mkdir /www
RUN chown -R www:www /var/lib/nginx
RUN chown -R www:www /www

RUN chown -R www:www /www

RUN mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.orig

COPY ./conf.d/nginx.conf /etc/nginx/nginx.conf

COPY . /web

WORKDIR /web

EXPOSE 80 443

CMD ["/usr/sbin/nginx", "-g", "daemon off;"]
