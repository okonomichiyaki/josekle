require 'json'
require 'sgf'
require_relative 'scrape.rb'

def oje_string_to_list(s)
    s.split(".")[2..] # skip "root" and leading empty string
end 

def oje_string_to_sgf(s)
    moves=oje_string_to_list(s)
    # convert to sgf notation:
    nodes = moves.each_with_index.map do |move,depth| 
        placement = ogs2sgf(move)
        node = SGF::Node.new()
        node.add_properties({color(depth+1) => placement})
        node
    end
    # stitch nodes together:
    root = nodes[0]
    parent = root
    nodes[1..].each do |child|
        parent.add_children(child)
        parent = child
    end
    tree = SGF::Gametree.new(root)
    coll = SGF::Collection.new()
    coll << tree
    coll.to_s.split("")
        .filter { |c| c != " " && c != "\n" }
        .join("")
end

def oje_string_to_puzzle(node_id, s)
    solution=oje_string_to_list(s).map { |oje| ogs2besogo(oje) }
    return {:node_id=>node_id, :solution=>solution}
end

def file_to_explorer(file)
    node_id = File.basename(file, ".*")
    json = JSON.parse(File.read(file))
    ExplorerPosition.new(node_id, json)
end

def save_as_js(puzzles, variable, filename)
    File.open(filename, 'w') do |file|
        file.write("const ");
        file.write(variable);
        file.write("=");
        file.write(JSON.unparse(puzzles))
        file.write(";");
    end
end

lengths={}
lt=0
gt=0
files = Dir.glob(ARGV[0]+"/*.json")
positions=files.map { |file| file_to_explorer(file) }
hard = positions.filter { |position| position.joseki? && !position.contains_pass? }
        .map { |position| oje_string_to_puzzle(position.node_id, position.oje_string) }
easy = positions.filter do |position|
    length=oje_string_to_list(position.oje_string).length
    (length < 10 && position.joseki? || position.basic?) && !position.contains_pass?
end.map { |position| oje_string_to_puzzle(position.node_id, position.oje_string) }
# all.each do |position|
#         length=oje_string_to_list(position.oje_string).length
#         if length < 10 || position.basic?
#             lt=lt+1
#         else
#             gt=gt+1
#         end
#         if !lengths[length]
#             lengths[length]=0
#         end
#         lengths[length]=lengths[length]+1
#     end
#     .map do |position|
#         play = position.oje_string
#         sgf = oje_string_to_sgf(play)
#         out = {}
#         out["node_id"] = position.node_id
#         out["sgf"] = sgf
#         #out["length"] = nodes.length + 1
#         out
#     end
# print JSON.unparse(josekis)
#lengths.sort.each do |k,v|
#    puts "k=#{k},v=#{v}"
#end

puts "hard=#{hard.length}"
puts "easy=#{easy.length}"
#puts "basic=#{basic.length}"
#puts "lt=#{lt},gt=#{gt}"

save_as_js(hard.shuffle, "hardPuzzles", "../hard.js")
save_as_js(easy.shuffle, "easyPuzzles", "../easy.js")
