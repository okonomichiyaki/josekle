function initModal() {
    var modal = document.getElementById("help-modal");

    // When the user clicks on <span> (x), close the modal
    document.getElementById("modal-close").onclick = function() {
        modal.style.display = "none";
    };

    // When the user clicks anywhere outside of the modal, close it
    modal.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    };
}
