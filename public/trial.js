document.addEventListener('DOMContentLoaded', async function () {
    const loggedInUserName = document.getElementById('user-name-div');
    //loggedInUserName.innerHTML = "Rakesh Kamat 1";
    const userResponse = await fetch('/admin/me', {
        method: 'GET'
    });
    if (!userResponse.ok) {
        console.log('Failed to save Service request:', response.json());
        throw new Error('Failed to upload Service request');
    }
    const result = await userResponse.json();
    console.log(result);
    loggedInUserName.innerHTML = "Hi " + result.me.firstname;
});