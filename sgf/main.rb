require_relative 'scrape.rb'

if ARGV.length < 2
    print "Usage: ruby main.rb <max depth> <out file> <nodes dir> <start node id>\n"
    exit 1
end

max = ARGV[0]
out = ARGV[1]
dir = ARGV[2]
start = ARGV[3]

root = scrape(start, dir, max.to_i)
save_sgf(root, out)
