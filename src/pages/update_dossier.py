
try:
    with open('EmployeeDossier.jsx', 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Keep lines 0 to 1262 (exclusive of 1263)
    # lines[0] is line 1.
    # lines[1261] is line 1262.
    part1 = lines[:1262]
    
    # Keep lines 1599 to End (inclusive of 1599)
    # lines[1598] is line 1599.
    part2 = lines[1598:]
    
    new_content = ''.join(part1) + '\n\n' + ''.join(part2)
    
    with open('EmployeeDossier.jsx', 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("File updated successfully.")

except Exception as e:
    print(f"Error: {e}")
