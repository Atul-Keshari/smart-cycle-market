const messageTag = document.getElementById('message');

window.addEventListener('DOMContentLoaded', async () => {
    const params = new Proxy(new URLSearchParams(window.location.search), {
        get: (searchParams, prop) => {
            return searchParams.get(prop);
        }
    });

    const token = params.token;
    const id = params.id;

    const res = await fetch('/auth/verify', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json;charset=utf-8',
        },
        body: JSON.stringify({
            token,
            id
        })
    })

    if(!res.ok){
        const {message} = await res.json();
        messageTag.innerHTML = message;
        messageTag.classList.add('error');
        return;
    }

    const {message} = await res.json();
    messageTag.innerHTML = message;
    
})