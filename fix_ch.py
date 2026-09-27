import os

f = 'apps/mobile/app/chat-history.tsx'
c = open(f).read()

old_block = """              <NeuView radius={20}
                key={session.session_id}
                style={[s.card, { }]}
                activeOpacity={0.7}
                onPress={() => router.push(`/chat?sessionId=${session.session_id}`)}
              >"""

new_block = """              <TouchableOpacity
                key={session.session_id}
                activeOpacity={0.7}
                onPress={() => router.push(`/chat?sessionId=${session.session_id}`)}
              >
                <NeuView radius={20} style={[s.card, { }]}>"""

c = c.replace(old_block, new_block)
c = c.replace("</NeuView>\n            </Animated.View>", "</NeuView>\n              </TouchableOpacity>\n            </Animated.View>")

open(f, 'w').write(c)

print("Fixed chat-history")
