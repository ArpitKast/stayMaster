async function checkUnique(type,field,role,id='') {
    try {
        const val = field.value;
        if(!val || val==''){
            return;
        }
        var url = `/admin/checkUnique/${type}/${val}/${role}/`;
        if(id != ''){
            url += id;
        }
        const response = await fetch(url, {
            method: 'GET'
        });
        if (!response.ok) {
            console.log('Failed to save Service request:', response.json());
            throw new Error('Failed to upload Service request');
        }
        const result = await response.json();
        return result.exists;
    } catch (error) {
        console.log(error);
    }
}