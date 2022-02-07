const debug = window.location.href.includes("debug=true");
const oneColor = window.location.href.includes("oneColor=true");
var circles = ["🟢","⚪","🟣"];
const GREEN = "🟢";
const WHITE = "⚪";
const YELLOW = "🟣";
const ROTATE = "🔄";

/* functions for emoji support detection */
function supportsEmoji (e) {
    const ctx = document.createElement("canvas").getContext("2d");
    ctx.canvas.width = ctx.canvas.height = 1;
    ctx.fillText(e, -4, 4);
    return ctx.getImageData(0, 0, 1, 1).data[3] > 0; // Not a transparent pixel
}
function supportsAll(emojis) {
    for (var i = 0; i < emojis.length; i++) {
        var e = emojis[i];
        if (!supportsEmoji(e)) {
            return false;
        }
    }
    return true;
}
const CIRCLES = supportsAll(circles);

/* daily puzzle */
function getNumber() {
    const re=/puzzle=(\d+)/;
    var m;
    if ((m = window.location.href.match(re)) && m.length > 1) {
        return parseInt(m[1]);
    }
    const dayMillis = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const start = new Date(2022, 1, 1);
    const today = new Date();
    return Math.ceil(Math.abs((start - today) / dayMillis));
}
function getTitle() {
    return "Josekle #"+getNumber();
}
function getSolution() {
    return puzzles[getNumber() % puzzles.length];
}

/* functions to get inputted sequence from besogo */
function extractMovesFrom(current) {
    var moves=[];
    if (current.markup.length > 0) {
        return []; // Detects if there are already hints
    }
    while (current.move !== null) {
        moves.push({x:current.move.x, y:current.move.y});
        current=current.parent;
    }
    return moves.reverse();
}
function getInputEditor() {
    return document.querySelector("#input-board").editor;
}
function extractMoves() {
    var inputBoard=document.querySelector("#input-board");
    var current=inputBoard.editor.getCurrent();
    return extractMovesFrom(current);
}
function pretty_print(moves) {
    return moves.map(move => move.x+"-"+move.y).join(", ");
}

/* functions to handle inputted guesses and update state on success */
function wasCorrect(hints, solution) {
    // Considers guess to be correct if the solution is a prefix
    for (i=0; i < hints.length && i < solution.length; i++) {
        if (hints[i]===YELLOW || hints[i]===WHITE) {
            return false;
        }
    }
    return solution.length <= hints.length;
}
function share() {
    var text = `[details="${getTitle()}"]\n`;
    text += guesses.map(guess => guess.join("")).join("\n");
    text += `\n[/details]`;
    text += "\n";
    text += "https://okonomichiyaki.github.io/josekle/";
    navigator.clipboard.writeText(text);
}
function toggleButtons() {
    var button = document.querySelector("input#Submit");
    button.value = "Share";
    button.id = "Share";
    button.title = "Share results via clipboard";
    button.onclick = share;
}
function display(hints, message) {
    var output = document.querySelector("#output");
    var p = document.createElement("p");
    if (CIRCLES) {
        p.innerText = hints + " " + message;
        output.appendChild(p);
    } else {
        var rest = [];
        var split = [...hints];
        split.forEach(c => {
            if (c === YELLOW) {
                var img = document.createElement("img");
                img.src = "img/emojis/yellow.png";
                p.appendChild(img);
            } else if (c === GREEN) {
                var img = document.createElement("img");
                img.src = "img/emojis/green.png";
                p.appendChild(img);
            } else if (c === WHITE) {
                var img = document.createElement("img");
                img.src = "img/emojis/white.png";
                p.appendChild(img);
            } else {
                rest.push(c);
            }
        });
        p.innerHTML += " " + message;
        output.appendChild(p);
    }
    document.querySelector(".besogo-hint").scrollTop = document.querySelector(".besogo-hint").scrollHeight;
}
function checkDictionary(moves) {
    if (!debug) {
        return true;
    }
    var isValid = true;
    const dict = document.querySelector("#dictionary-board").editor;
    moves.forEach(move => {
        isValid &= dict.navigate(move.x, move.y, false);
    })
    dict.prevNode(-1);// reset the dictionary board
    return isValid;
}
function submit() {
    var moves = extractMoves();
    if (moves.length === 0) {
        return;
    }
    var solution = getSolution();
    var hints = getInputEditor().check(solution);
    if (debug) {
        console.log("guess: " + pretty_print(moves));
        console.log("solution: " + pretty_print(solution));
        console.log(hints);
    }
    submissions.push(moves);
    guesses.push(hints);
    var message = "";
    if (moves.length < solution.length) {
        message = "Too few moves";
    } else if (moves.length > solution.length) {
        message = "Too many moves";
    }
    if (wasCorrect(hints, solution)) {
        if (hints.length > solution.length) {
            message = " Good Enough!";
        } else {
            switch(guesses.length) {
                case 1:
                    message = " Genius";
                    break;
                case 2:
                    message = " Magnificent";
                    break;
                case 3:
                    message = " Impressive";
                    break;
                case 4:
                    message = " Splendid";
                    break;
                case 5:
                    message = " Great";
                    break;
                default:
                    message = " Phew";
            }
        }
        toggleButtons();
        storageClear(getTitle());
        storageSave(getTitle(),{
            submissions: submissions
        });
    } else if (!checkDictionary(moves)) {
        message = "Not present in the dictionary?"; 
    }
    display(hints.join(""), message);
}

function startOneColorMode() {
    const solution = getSolution();
    const editor = getInputEditor();
    for (var i = solution.length - 1; i >= 0; i--) {
        var move = solution[i];
        editor.getRoot().addMarkup(move.x,move.y,2);
    }
    editor.toggleVariantStyle(); // toggles a redraw
}

/* functions to save and restore previous correct attempt */
function storageSave(key, val) {
    if (localStorage) {
        localStorage.setItem(key, JSON.stringify(val));
    }
}
function storageLoad(key) {
    if (localStorage) {
        const json = localStorage.getItem(key);
        if (json) {
            return JSON.parse(json);
        }
    }
    return null;
}
function storageClear(key) {
    if (localStorage) {
        if (key) {
            localStorage.setItem(key, null);
        } else {
            localStorage.clear();
        }
    }
}
function tryRestore() {
    if (!debug) {
        return false;
    }
    const dark = storageLoad("dark");
    if (dark === "on") {
        document.querySelector('button[title="Toggle dark theme"]').click();
    }
    const zoom = storageLoad("zoom");
    if (zoom) {
        const editor = getInputEditor();
        editor.setZoom(zoom);
    }
    const previous = storageLoad(getTitle());
    if (previous && previous["submissions"] !== null && previous["submissions"].length > 0) {
        const submissions = previous["submissions"];
        const editor = getInputEditor();
        for (var i = 0; i < submissions.length; i++) {
            const submission = submissions[i];
            submission.forEach(move => {
                editor.click(move.x, move.y, false, false);
            });
            document.querySelector("#Submit").click();
            if (i < submissions.length - 1) {
                editor.prevNode(-1);
            }
        };
        return true;
    }
    return false;
}
const submissions = [];
const guesses = [];
window.onload = function() {
    besogo.autoInit();
    document.querySelector("div#title").innerText=getTitle();
    getInputEditor().addListener(function(msg) {
        if (msg.zoom) {
            storageSave("zoom", msg.zoom);
        }
        if (msg.dark === false || msg.dark === true) {
            const value = msg.dark ? "on" : "off";
            storageSave("dark", value);
        }
    })
    const restored = tryRestore();
    if (oneColor && !restored) {
        startOneColorMode();
    }
};
