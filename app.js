const debug = window.location.href.includes("debug=true");
var circles = ["🟢","⚪","🟣"];
const GREEN = "🟢";
const WHITE = "⚪";
const YELLOW = "🟣";
const ROTATE = "🔄";
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
var guesses=[];
var today = getNumber();

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
function getSolution() {
    return puzzles[today % puzzles.length];
}
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
function extractMoves() {
    var inputBoard=document.querySelector("#input-board");
    var current=inputBoard.editor.getCurrent();
    return extractMovesFrom(current);
}
function pretty_print(moves) {
    return moves.map(move => move.x+"-"+move.y).join(", ");
}

// OLD functions to check correctness of moves, now using editor-based function
function isYellow(candidate, solution) {
    return solution.find(move => move.x===candidate.x && move.y===candidate.y);
}
function check(moves, solution) {
    var output = [];
    var inputBoard=document.querySelector("#input-board");
    for (i = 0; i < moves.length; i++) {
        var move = moves[i];
        if (i < solution.length && move.x === solution[i].x && move.y === solution[i].y) {
            output.push(GREEN);
            // inputBoard.editor.setHint(move.x, move.y, 1);
        } else if (isYellow(move, solution)) {
            output.push(YELLOW);
            // inputBoard.editor.setHint(move.x, move.y, 2);
        } else {
            output.push(WHITE);
            // inputBoard.editor.setHint(move.x, move.y, 3);
        }
    }
    return output;
}

function reflect(moves) {
    return moves.map(move => {
        return {x:move.y, y:move.x};
    });
}
function normalize(moves) {
    return moves.map(normalize_move);
}
function normalize_move(move) {
    var x = move.x;
    var y = move.y;
    if (move.x > 10) {
        x=19-move.x+1;
    }
    if (move.y > 10) {
        y=19-move.y+1;
    }
    return {x:x, y:y};
}
function better(a, b) {
    var ayellows = a.filter(x => x === YELLOW).length;
    var byellows = b.filter(x => x === YELLOW).length;
    var agreens = a.filter(x => x === GREEN).length;
    var bgreens = b.filter(x => x === GREEN).length;
    return (ayellows + agreens*2) > (byellows + bgreens*2);
}
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
    var text = `[details="Josekle #${today}"]\n`;
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
    if (debug) {
        console.log("guess: " + pretty_print(moves));
        console.log("solution: " + pretty_print(solution));
    }
    var hints = document.querySelector("#input-board").editor.check(solution);
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
    } else if (!checkDictionary(moves)) {
        message = "Not present in the dictionary?"; 
    }
    display(hints.join(""), message);
}

// utilities for collecting josekis:
function copyPuzzles() {
    var inputBoard=document.querySelector("#input-board");
    var root=inputBoard.editor.getRoot();
    var leaves=[];
    var nodes=[];
    if (root.children.length>0) {
        nodes.push(root);
    }
    while (nodes.length>0) {
        var node = nodes.pop();
        if (node.children.length===0) {
            leaves.push(node);
        } else {
            node.children.forEach(child => { nodes.push(child) });
        }
    }
    console.log("found " + leaves.length + " leaves");
    var collection = leaves.map(extractMovesFrom).map(JSON.stringify);
    var text = collection.join(",\n");
    navigator.clipboard.writeText(text);
}
window.onload = function() {
    besogo.autoInit();
    document.querySelector("div#title").innerText="Josekle #"+today;
    if (debug) {
        document.querySelector("#copy-puzzles").classList.remove("hide");
    }
};
