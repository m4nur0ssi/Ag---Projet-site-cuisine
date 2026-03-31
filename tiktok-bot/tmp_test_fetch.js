const fetch = require('node-fetch');

async function testFetch() {
    const slug = 'messe-libanais-boulettes-de-boeuf-houmous-maison';
    const url = `http://192.168.1.200/wordpress/wp-json/wp/v2/posts?slug=${slug}&_embed`;

    try {
        const res = await fetch(url);
        const data = await res.json();

        if (data && data.length > 0) {
            const post = data[0];
            console.log('TITLE:', post.title.rendered);
            console.log('CONTENT START:', post.content.rendered.substring(0, 500));
            console.log('-------------------');
            console.log('CONTENT END:', post.content.rendered.substring(post.content.rendered.length - 500));
        } else {
            console.log('Post non trouvé');
        }
    } catch (e) {
        console.error('Erreur:', e.message);
    }
}

testFetch();
ca va ?