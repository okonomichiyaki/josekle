const debug = window.location.href.includes("debug=true");
const clearStorage = window.location.href.includes("clearStorage=true");
const oneColor = storageLoad('oneColor');
const hardMode = storageLoad('hardMode');
var circles = ["🟢","⚪","🟣"];
const GREEN = "🟢";
const WHITE = "⚪";
const YELLOW = "🟣";
const GREEN_SQUARE = "🟩";
const WHITE_SQUARE = "⬜";
const YELLOW_SQUARE = "🟪";
const TODAY = new Date();

function toggleHardMode() {
    storageSave('hardMode', !hardMode);
    window.location.reload();
}

function toggleOneColor() {
    storageSave('oneColor', !oneColor);
    window.location.reload();
}

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
const SQUARES = supportsAll([GREEN_SQUARE, YELLOW_SQUARE, WHITE_SQUARE]);

/* daily puzzle */
function getNumber() {
    const re=/puzzle=(\d+)/;
    var m;
    if ((m = window.location.href.match(re)) && m.length > 1) {
        return parseInt(m[1]);
    }
    const dayMillis = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const start = new Date(2022, 1, 1);
    return Math.ceil(Math.abs((start - TODAY) / dayMillis));
}
const PUZZLE_NUMBER = getNumber();
function getTitle(n) {
    if (typeof n === "undefined") {
        n = 0;
    }
    var difficulty = " (" + getSolution().solution.length + " moves";
    if (oneColor) {
        difficulty += ", one color";
    }
    if (hardMode) {
        difficulty += ", hard";
    }
    difficulty += ")";
    return "Josekle #" + (PUZZLE_NUMBER + n) + difficulty;
}
function getSolution() {
    if (PUZZLE_NUMBER < 15) {
        const oldPuzzle = puzzles[PUZZLE_NUMBER % puzzles.length]; //old puzzles
        return {"node_id": null, "solution": oldPuzzle};
    } else {
        if (hardMode) {
            return hardPuzzles[PUZZLE_NUMBER % hardPuzzles.length];
        } else {
            return easyPuzzles[PUZZLE_NUMBER % easyPuzzles.length];
        }
    }
}

/* functions to get inputted sequence from besogo */
function extractMovesFrom(current) {
    var moves=[];
    if (current.submitted) {
        showPopup("Already submitted");
        return [];
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
        if (hints[i] !== GREEN) {
            return false;
        }
    }
    return solution.length <= hints.length;
}
function share() {
    var text = getTitle() + "\n";
    text += guesses.map(guess => guess.join("")).join("\n");
    text += "\n";
    text += "https://okonomichiyaki.github.io/josekle/";
    navigator.clipboard.writeText(text);
    showPopup("Copied to clipboard");
}
function makeButton(value, title, onclick) {
    element = document.createElement('input');
    element.type = 'button';
    element.value = value;
    element.title = title;
    element.onclick = onclick;
    return element;
}
function scrollHints() {
    document.querySelector(".besogo-hint").scrollTop = document.querySelector(".besogo-hint").scrollHeight;
}
function toggleButtons() {
    document.querySelector('#output').appendChild(
        makeButton("Share", "Copy results to clipboard", share)
    );
    document.querySelector('#Submit').classList.add("hidden");
}
function showExplorerLink(nodeId) {
    if (nodeId === null || nodeId === undefined) { // old puzzles don't have node
        return;
    }
    document.querySelector("#output").appendChild(
        makeButton("OGS Explorer", "View this joseki on OGS Joseki Explorer", function() {
            window.location="https://online-go.com/joseki/" + nodeId;
        }));
}
function display(hints, message) {
    var output = document.querySelector("#output");
    var p = document.createElement("p");
    if (CIRCLES && SQUARES) {
        p.innerText = hints + " " + message;
        output.appendChild(p);
    } else {
        var rest = [];
        var split = [...hints];
        const symbols = [YELLOW, GREEN, WHITE, YELLOW_SQUARE, GREEN_SQUARE, WHITE_SQUARE];
        const imageNames = ["yellow", "green", "white", "yellow-square", "green-square", "white-square"];
        split.forEach(c => {
            const foundIndex = symbols.indexOf(c);
            if (foundIndex >= 0) {
                var img = document.createElement("img");
                img.src = `img/emojis/${imageNames[foundIndex]}.png`;
                img.className = "besogo-emoji";
                p.appendChild(img);
            } else {
                rest.push(c);
            }
        });
        p.innerHTML += " " + message;
        output.appendChild(p);
    }
    scrollHints();
}
function isDictionaryReady() {
    const dict = document.querySelector("#dictionary-board").editor;
    // the dictionary should be ready if 4-4 is navigable:
    const ready = dict.navigate(16, 4, false);
    dict.prevNode(-1);
    return ready;
}
function checkDictionary(moves) {
    var isValid = true;
    let counter = 0;
    const dict = document.querySelector("#dictionary-board").editor;
    moves.forEach(move => {
        isValid &= dict.navigate(move.x, move.y, false);
        if (isValid) ++counter;
    })
    dict.prevNode(-1);// reset the dictionary board
    return counter;
}

function showPopup(text) {
    var popup = document.querySelector("#notify");
    popup.classList.add("active");
    document.getElementById('notify-text').innerText = text;
    setTimeout(function(){
        popup.classList.remove("active");
    }, 1200);
}

function submit() {
    var moves = extractMoves();
    if (moves.length === 0) {
        return;
    }
    const puzzle = getSolution();
    const solution = puzzle.solution;
    if (moves.length > solution.length) {
        showPopup("Too many moves");
        return;
    }
    var hints = getInputEditor().check(solution);

    var firstUnknownMoveIndex = checkDictionary(moves);
    if (firstUnknownMoveIndex < moves.length) {
        hints = hints.map((circle, index) => {
            if (index < firstUnknownMoveIndex) {
                return circle;
            } else {
                if (circle === GREEN) return GREEN_SQUARE;
                if (circle === YELLOW) return YELLOW_SQUARE;
                if (circle === WHITE) return WHITE_SQUARE;
            }
        })
    }

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
    const solved = wasCorrect(hints, solution);
    if (solved) {
        if (hints.length > solution.length) {
            message = "Good Enough!";
        } else {
            switch(guesses.length) {
                case 1:
                    message = "Genius";
                    break;
                case 2:
                    message = "Magnificent";
                    break;
                case 3:
                    message = "Impressive";
                    break;
                case 4:
                    message = "Splendid";
                    break;
                case 5:
                    message = "Great";
                    break;
                default:
                    message = "Phew";
            }
        }
    } else if (firstUnknownMoveIndex < moves.length) {
        message = "Not present in the dictionary?";
    }
    storageSave(getTitle(),{
        submissions: submissions,
        solved: solved,
    });
    display(hints.join(""), message);
    if (solved) {
        toggleButtons();
        showExplorerLink(puzzle.node_id);
        scrollHints();
    }
}

function startOneColorMode() {
    const puzzle = getSolution();
    const solution = puzzle.solution;
    const editor = getInputEditor();
    for (var i = solution.length - 1; i >= 0; i--) {
        var move = solution[i];
        editor.getRoot().addMarkup(move.x,move.y,2);
    }
    editor.setVariantStyle(editor.getVariantStyle()); // toggles a redraw
}

/* functions to save and restore previous attempts */
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
            localStorage.removeItem(key);
        } else {
            localStorage.clear();
        }
    }
}
function tryRestore() {
    const dark = storageLoad("dark");
    if (dark === "on") {
        document.querySelector('button[title="Toggle dark theme"]').click();
    }
    const zoom = storageLoad("zoom");
    if (zoom) {
        const editor = getInputEditor();
        editor.setZoom(zoom);
    }
    const saved = storageLoad(getTitle());
    if (saved && saved["submissions"] !== null && saved["submissions"].length > 0) {
        const submissions = saved["submissions"];
        const editor = getInputEditor();
        for (var i = 0; i < submissions.length; i++) {
            const submission = submissions[i];
            submission.forEach(move => {
                editor.click(move.x, move.y, false, false);
            });
            submit();
            // after replaying each but the last, reset to root to keep replaying:
            if (i < submissions.length - 1) {
                editor.prevNode(-1);
            } else {
                // for the last replay, if unsolved, also reset
                // if solved, will not reset to display the solution
                if (!saved["solved"]) {
                    editor.prevNode(-1);
                }
            }
        };
        return true;
    } else {
        storageClear(getTitle(-1));
    }
    return false;
}
const submissions = [];
const guesses = [];
window.onload = function() {
    if (clearStorage) {
        localStorage.clear();
    }
    besogo.autoInit();
    initModal();
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
    var wait = setInterval(function () {
        if (isDictionaryReady()) {
            if (oneColor) {
                startOneColorMode();
            }
            tryRestore();
            clearInterval(wait);
        }
    }, 100);
};
