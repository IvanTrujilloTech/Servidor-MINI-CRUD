# Imagen oficial con PHP 8.4 + Apache
FROM php:8.4-apache

# Instalar herramientas básicas y Composer
RUN apt-get update && apt-get install -y git unzip curl \
 && rm -rf /var/lib/apt/lists/* \
 && curl -sS https://getcomposer.org/installer | php \
 -- --install-dir=/usr/local/bin --filename=composer

WORKDIR /var/www/html