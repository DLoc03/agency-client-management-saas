FROM php:8.3-cli

# System packages & PHP extensions required by Laravel + this project
RUN apt-get update && apt-get install -y --no-install-recommends \
    git unzip libzip-dev libicu-dev libpng-dev libonig-dev libxml2-dev \
    && docker-php-ext-install pdo_mysql mbstring zip intl gd bcmath \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Redis extension
RUN pecl install redis && docker-php-ext-enable redis

# Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html
EXPOSE 8000
