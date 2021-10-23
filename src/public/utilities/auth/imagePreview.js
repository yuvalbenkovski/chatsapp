const inpFile = document.getElementById("inpFile");
const previewContainer = document.getElementById("imagePreview");
const previewImage = previewContainer.querySelector(".img-preview-img");
inpFile.addEventListener("change", function () {
    const file = this.files[0];
    if (file) {
        const reader = new FileReader();
        reader.addEventListener("load", function () {
            previewContainer.style.backgroundImage = ""
            previewImage.style.display = "block";
            previewImage.setAttribute("src", this.result)
        });
        reader.readAsDataURL(file)
    }
    else {
        previewContainer.style.backgroundImage = "url('/images/blank-profile-picture.png')"
        previewImage.style.display = null;
        previewImage.setAttribute("src", "")
    }
});