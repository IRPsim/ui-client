Static content must go in a subfolder res/www/html/...

Build an image by using:

    docker build -t image-name:version .

Start an image inside a container by using:

    docker run -p 80:80 -d image-name
    
You can then find the static content at http://localhost.