const http = require('http');

const slug = 'messe-libanais-boulettes-de-boeuf-houmous-maison';
const url = `http://192.168.1.200/wordpress/wp-json/wp/v2/posts?slug=${slug}`;

http.get(url, (res) => {
    let rawData = '';
    res.on('data', (chunk) => { rawData += chunk; });
    res.on('end', () => {
        try {
            const posts = JSON.parse(rawData);
            if (posts && posts.length > 0) {
                const post = posts[0];
                console.log('--- POST FOUND ---');
                console.log('ID:', post.id);
                console.log('TITLE:', post.title.rendered);
                console.log('CONTENT:\n', post.content.rendered);
                console.log('--- END ---');
            } else {
                console.log('Post not found');
            }
        } catch (e) {
            console.error('ERROR:', e.message);
        }
    });
}).on('error', (err) => {
    console.error('HTTP ERROR:', err.message);
});
