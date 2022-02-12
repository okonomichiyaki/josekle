require 'json'
require_relative 'scrape.rb'

if ARGV.length < 2
    print "Usage: ruby main.rb <max depth> <nodes dir> <start node id> <dictionary output file (SGF)> <puzzles out file (JSON)>\n"
    exit 1
end

max = ARGV[0]
dir = ARGV[1]
start = ARGV[2]
dictionary_file = ARGV[3]
puzzles_file = ARGV[4]

output = scrape(start, dir, max.to_i)
root = output[:dictionary]
puzzles = output[:puzzles]
save_puzzles(puzzles, puzzles_file)
save_sgf(root, dictionary_file)
