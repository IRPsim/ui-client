FROM ubuntu:24.04

# Update package list
RUN apt-get update && apt-get -y install curl && apt-get -y install apache2

ADD proxy.conf /etc/apache2/sites-available/000-default.conf
ADD deflate.conf /etc/apache2/mods-available/deflate.conf

RUN a2enmod proxy proxy_http deflate cache cache_disk headers rewrite mime
EXPOSE 80

COPY www/ /var/www/html/

CMD ["/usr/sbin/apache2ctl", "-D", "FOREGROUND"]
