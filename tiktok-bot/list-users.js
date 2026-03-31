const fetch = require('node-fetch');

async function listUsers() {
    const url = 'http://192.168.1.200/wordpress/wp-json/wp/v2/users';
    console.log(`Listing users from: ${url}`);
    try {
        const res = await fetch(url);
        const data = await res.json();
        console.log('--- USERS FOUND ---');
        if (Array.isArray(data)) {
            data.forEach(u => {
                console.log(`ID: ${u.id}, Name: ${u.name}, Slug: ${u.slug}`);
            });
        } else {
            console.log('Error listing users:', data);
        }
    } catch (e) {
        console.error('Error:', e.message);
    }
}

listUsers();
