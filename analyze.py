import re

with open('src/scenes.ts', 'r') as f:
    content = f.read()

# Extract all scenes
scenes = []
lines = content.split('\n')
current_scene = {}

for i, line in enumerate(lines):
    if "id: '" in line:
        if current_scene and 'id' in current_scene:
            scenes.append(current_scene)
        match = re.search(r"id: '([^']+)'", line)
        current_scene = {'id': match.group(1)}
    elif 'tier:' in line and 'current_scene' in locals():
        match = re.search(r"tier: '([^']+)'", line)
        current_scene['tier'] = match.group(1)
    elif 'width:' in line and 'current_scene' in locals():
        match = re.search(r'width: (\d+)', line)
        current_scene['width'] = int(match.group(1))
    elif 'buildings: [' in line and 'current_scene' in locals():
        # Count buildings
        j = i + 1
        count = 0
        while j < len(lines) and ']' not in lines[j]:
            if 'dx:' in lines[j]:
                count += 1
            j += 1
        current_scene['buildings'] = count

if current_scene and 'id' in current_scene:
    scenes.append(current_scene)

# Group by tier
tiers = {'bot': [], 'mid': [], 'midB': [], 'top': []}
for scene in scenes:
    if all(k in scene for k in ['id', 'tier', 'width', 'buildings']):
        tiers[scene['tier']].append(scene)

# Print analysis
for tier in ['bot', 'mid', 'midB', 'top']:
    tier_scenes = tiers[tier]
    if tier_scenes:
        avg_buildings = sum(s['buildings'] for s in tier_scenes) / len(tier_scenes)
        avg_width = sum(s['width'] for s in tier_scenes) / len(tier_scenes)
        print(f"\n{tier.upper()} ({len(tier_scenes)} scenes):")
        print(f"  Avg width: {avg_width:.1f}, Avg buildings: {avg_buildings:.1f}")
        for s in sorted(tier_scenes, key=lambda x: x['width'], reverse=True):
            print(f"    {s['id']:30s} {s['width']:3d}w x {s['buildings']} bldgs")
