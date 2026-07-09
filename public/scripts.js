
document.addEventListener('DOMContentLoaded', function () {
	const uploadButton = document.getElementById('upload-button');
    const addPropertyForm = document.getElementById('add-property-form');
	const displayPictureDropzone = document.getElementById('display-picture-dropzone');
	const displayPictureError = document.getElementById('display-picture-error');
    let displayPictureFile = null;

	uploadButton.addEventListener('click', async () => {
		if (!addPropertyForm.checkValidity()) {
			addPropertyForm.reportValidity();
			return;
		}
		if (!displayPictureFile) {
			alert("Display picture is mandatory");
			displayPictureError.style.display = 'block';
			return;
		}
		try {
			const formData = new FormData(addPropertyForm);
			const displayPictureFiles = document.getElementById('display-picture-dropzone').querySelectorAll('img:not(.delete-icon)');
			const propertyPictures = document.querySelectorAll('.dropzone[id$="-dropzone"]');
			// Add display picture to formData
			if (displayPictureFiles.length > 0) {
				formData.append('display_image', displayPictureFiles[0].file);
			}

			// Add property pictures to formData
			propertyPictures.forEach(dropzone => {
				const category_id = dropzone.getAttribute('data-category');
				const images = dropzone.querySelectorAll('img:not(.delete-icon)');
				//formData.append(`titles_${category_id}`, img.title); // Adjust as per your HTML structure
				//formData.append(`descriptions_${category_id}`, img.description); // Adjust as per your HTML structure
				images.forEach((img, index) => {
					formData.append(`photos_${category_id}`, img.file);
					formData.append(`category_ids_${category_id}`, category_id);
				});
			});

			// Send formData to backend
			const response = await fetch('/api/properties/x', {
				method: 'POST',
				body: formData,
			});

			if (!response.ok) {
				console.log('Failed to upload property:', response.json())
				throw new Error('Failed to upload property');
			}

			const result = await response.json();
			console.log('Property uploaded successfully:', result);
			alert('Property uploaded successfully');
			window.location.href = '/api/properties/listing';
		} catch (error) {
			console.error('Error uploading property:', error);
			alert('Failed to upload property');
		}
	});

	displayPictureDropzone.addEventListener('dragover', (e) => {
		e.preventDefault();
		displayPictureDropzone.style.backgroundColor = '#e0e0e0';
	});
	
	displayPictureDropzone.addEventListener('dragleave', () => {
		displayPictureDropzone.style.backgroundColor = '#fff';
	});
	
	displayPictureDropzone.addEventListener('drop', (e) => {
		e.preventDefault();
		displayPictureDropzone.style.backgroundColor = '#fff';
		
		const files = Array.from(e.dataTransfer.files);
		if (files.length > 1) {
			alert('Only one display picture is allowed.');
		} else {
			handleDisplayPicture(files[0]);
		}
	});
	
	displayPictureDropzone.addEventListener('click', () => {
		const input = document.createElement('input');
		input.type = 'file';
		input.onchange = (e) => {
			const file = e.target.files[0];
			handleDisplayPicture(file);
		};
		input.click();
	});

	function handleDisplayPicture(file) {
		if (file && file.type.startsWith('image/')) {
			const existingImg = displayPictureDropzone.querySelector('img:not(.delete-icon)');
			if (existingImg) {
				alert('Only one display picture is allowed.');
				return;
			}

			const reader = new FileReader();
			reader.readAsDataURL(file);
			reader.onload = () => {
				const img = document.createElement('img');
				img.src = reader.result;
				img.file = file;
				displayPictureDropzone.appendChild(img);

				const deleteIcon = document.createElement('img');
				deleteIcon.src = 'delete_icon_url'; // Provide URL for delete icon
				deleteIcon.classList.add('delete-icon');
				displayPictureDropzone.appendChild(deleteIcon);

				deleteIcon.addEventListener('click', () => {
					displayPictureDropzone.innerHTML = 'Display picture';
					displayPictureFile = null;
					displayPictureError.style.display = 'block';
				});
				displayPictureFile = file;
                displayPictureError.style.display = 'none';
			};
		}
	}

	const dropzones = document.querySelectorAll('.dropzone:not(#display-picture-dropzone)');
	
	dropzones.forEach(dropzone => {
		dropzone.addEventListener('dragover', (e) => {
			e.preventDefault();
			dropzone.style.backgroundColor = '#e0e0e0';
		});
		
		dropzone.addEventListener('dragleave', () => {
			dropzone.style.backgroundColor = '#fff';
		});
		
		dropzone.addEventListener('drop', (e) => {
			e.preventDefault();
			dropzone.style.backgroundColor = '#fff';
			
			const files = Array.from(e.dataTransfer.files);
			handleFiles(files, dropzone);
		});
		
		dropzone.addEventListener('click', () => {
			const input = document.createElement('input');
			input.type = 'file';
			input.multiple = true;
			input.onchange = (e) => {
				const files = Array.from(e.target.files);
				handleFiles(files, dropzone);
			};
			input.click();
		});
	});

	function handleFiles(files, dropzone) {
		files.forEach(file => {
			if (file.type.startsWith('image/')) {
				const reader = new FileReader();
				reader.readAsDataURL(file);
				reader.onload = () => {
					const imgContainer = document.createElement('div');
					imgContainer.style.position = 'relative';
					imgContainer.style.display = 'inline-block';
					imgContainer.draggable = true;

					const img = document.createElement('img');
					img.src = reader.result;
					img.file = file;
					imgContainer.appendChild(img);

					const deleteIcon = document.createElement('img');
					deleteIcon.src = 'delete_icon_url'; // Provide URL for delete icon
					deleteIcon.classList.add('delete-icon');
					imgContainer.appendChild(deleteIcon);

					deleteIcon.addEventListener('click', () => {
						imgContainer.remove();
					});
					dropzone.appendChild(imgContainer);

					// Enable drag-and-drop reordering
					imgContainer.addEventListener('dragstart', (e) => {
						e.dataTransfer.effectAllowed = 'move';
						e.dataTransfer.setData('text/plain', null);
						imgContainer.classList.add('dragging');
					});

					imgContainer.addEventListener('dragover', (e) => {
						e.preventDefault();
						const draggingElement = document.querySelector('.dragging');
						if (draggingElement !== imgContainer) {
							const bounding = imgContainer.getBoundingClientRect();
							const offset = bounding.y + (bounding.height / 2);
							if (e.clientY - offset > 0) {
								imgContainer.style['border-bottom'] = '2px solid blue';
								imgContainer.style['border-top'] = '';
							} else {
								imgContainer.style['border-top'] = '2px solid blue';
								imgContainer.style['border-bottom'] = '';
							}
						}
					});

					imgContainer.addEventListener('dragleave', () => {
						imgContainer.style['border-bottom'] = '';
						imgContainer.style['border-top'] = '';
					});

					imgContainer.addEventListener('drop', (e) => {
						e.preventDefault();
						const draggingElement = document.querySelector('.dragging');
						if (draggingElement !== imgContainer) {
							const bounding = imgContainer.getBoundingClientRect();
							const offset = bounding.y + (bounding.height / 2);
							if (e.clientY - offset > 0) {
								imgContainer.style['border-bottom'] = '';
								imgContainer.insertAdjacentElement('afterend', draggingElement);
							} else {
								imgContainer.style['border-top'] = '';
								imgContainer.insertAdjacentElement('beforebegin', draggingElement);
							}
						}
					});

					imgContainer.addEventListener('dragend', () => {
						imgContainer.classList.remove('dragging');
						imgContainer.style['border-bottom'] = '';
						imgContainer.style['border-top'] = '';
					});
				};
			}
		});
	}
});