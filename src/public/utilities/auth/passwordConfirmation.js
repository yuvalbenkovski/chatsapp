const registrationForm = document.getElementById('registration-form')
registrationForm.addEventListener('submit', function (e) {
    e.preventDefault()
    this.password.value === this.passwordConfirm.value ? this.submit() : alert('Passwords do not match !')
})