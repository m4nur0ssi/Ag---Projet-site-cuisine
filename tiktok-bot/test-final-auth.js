const fetch = require('node-fetch');

async function test() {
    const user = 'm4nu';
    const passwords = ['2TlsWemp!', '2TlsGemp!!'];

    for (const p of passwords) {
        console.log(`\n--- Testing password: ${p} ---`);
        const variants = [
            `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me?bot_password=${encodeURIComponent(p)}`,
            `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me?_auth_user=${user}&_auth_pass=${encodeURIComponent(p)}`,
            `http://192.168.1.200/wordpress/wp-json/wp/v2/users/me?user=${user}&pass=${encodeURIComponent(p)}`
        ];

        for (const url of variants) {
            console.log(`Testing: ${url}`);
            try {
                const res = await fetch(url);
                console.log(`Status: ${res.status}`);
                const text = await res.text();
                if (res.ok) {
                    console.log(`✅ SUCCESS!`);
                    process.exit(0);
                }
            } catch (e) {
                console.log(`Error: ${e.message}`);
            }
        }
    }
}

test();
