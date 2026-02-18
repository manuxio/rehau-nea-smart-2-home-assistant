# REHAU NEA SMART 2.0 MQTT Bridge

```
⣿⢻⣟⡿⣝⣯⢸⢣⠯⣝⢣⢏⠣⣇⠳⣌⢲⡈⡒⣌⢒⠢⡜⢒⡸⣐⢃⡒⡜⣂⡓⡜⣢⢓⣂⢳⡘⣆⡓⢎⡲⣑⢎⣓⡚⣌⢳⡙⣬⠓⣜⡢⢓⢄⠳⣘⢂⡓⣌⠢⡑⢢⠘⣄⠣
⣿⣻⣾⣽⣻⣼⢪⣏⡻⣌⢳⣊⡝⢬⠲⡔⢢⠱⡘⢤⢊⡵⠘⢦⣁⠒⠦⣁⠲⠄⠣⣜⢰⢣⠜⢦⠳⡤⡙⠴⣁⢎⠲⡔⡱⢊⢦⠱⢆⡙⢢⡁⠧⣈⠲⡰⢌⠶⠤⢣⡑⢆⢃⢆⠣
⣟⡷⣻⢳⡟⣼⢱⣎⢷⣸⣿⣿⠸⣆⠳⣡⢋⠴⡙⢢⢃⠖⣩⠖⠤⢋⠦⣁⠎⡌⠱⡌⢎⡣⡌⢧⢣⠵⡉⢖⡩⢌⠱⣌⠱⡉⢦⡉⢦⣉⠦⡱⢃⠆⡳⡹⡌⢧⠛⣤⠙⣌⠒⢬⠑
⡿⣹⢧⢻⡜⣧⠹⣬⠳⢾⣿⣿⢳⡜⣣⠦⣙⠬⡱⢃⠎⡭⠰⣍⠲⣉⠦⢡⠊⡔⢣⠸⣌⠱⢌⢣⠋⠴⣉⠆⡒⢍⢒⡌⠲⡑⠦⡙⠦⡜⢬⡱⠩⢌⠵⡡⢏⠼⣉⠦⡙⢤⠙⡤⣉
⣻⢵⣋⢧⡻⣬⢻⡜⣫⢽⣿⣿⢣⡟⡴⢣⠎⡵⢡⢋⠼⡰⣉⠦⠱⡨⠜⡤⠩⠌⡥⠒⣌⢣⢃⠮⣍⠳⢄⢣⡙⠤⢣⠜⡡⢎⡱⢉⠖⡩⢒⡌⢣⡉⢖⠱⣊⠧⡜⢬⡑⢢⡙⠤⡡
⣿⢮⣝⢮⡵⣳⢬⣛⣜⣻⣿⣿⢣⡻⣜⢣⢚⠥⣋⠬⢣⡑⢦⣉⠳⡘⠦⢌⢣⠓⢬⠱⡌⠦⣉⠶⣌⠱⡊⠵⡈⢇⠎⠴⢱⠈⡆⢍⠪⢔⠣⡜⡡⠜⡌⡓⠤⢓⠬⢣⠜⡡⢜⢢⡑
⣭⣛⢾⡻⣜⡳⣜⡜⢶⣹⣿⣿⢃⡳⣘⢆⣋⠞⡴⢋⠖⣭⠲⣌⠧⡑⢎⡘⢢⡙⣂⠣⢌⡑⢢⠱⣌⢣⡙⠦⡙⢌⠚⡌⠢⣍⠐⣊⠘⡌⡒⡱⠘⠤⡑⢭⠘⡅⢎⡥⢚⡈⢆⠣⡜
⡧⣛⠞⡝⢧⡛⡴⡙⢦⣹⣿⣿⢜⡲⣱⢊⡖⣩⠒⡭⣚⠤⢳⡘⣒⢍⠲⡘⢄⢢⢁⡒⣌⢂⣃⡞⡐⢦⡘⢢⡑⡊⢌⡐⠣⡐⡘⠄⢣⠘⡔⣡⠙⡔⣉⢆⢣⡑⠎⡔⣣⠘⡬⢓⡌
⡣⢍⢎⡙⢦⢓⡱⡙⢦⣹⣿⣿⢌⡳⣡⢳⡘⢥⢓⡰⢃⠞⣡⠚⡌⢎⣱⢊⡏⠐⡀⠀⠀⣈⢁⢒⠹⢢⡌⢡⠂⡍⢂⠜⡰⢠⠑⡘⠤⡑⡰⢀⡣⡐⢆⠎⣆⠹⡘⢆⡣⢜⡡⢇⡎
⢧⡙⢦⡙⣎⠞⡴⣉⠗⣼⣿⣿⢸⡱⢣⠖⣩⠎⠦⣑⠪⡜⢢⠝⡰⢢⢿⡫⠄⠁⠀⠀⢹⣭⢷⢪⠆⣡⢱⢣⢉⠰⡉⢂⠆⣡⠚⡐⢂⠱⣐⠡⢢⢑⡃⢎⡔⢣⡹⢌⠲⡘⢆⡣⢚
⠧⣜⢢⡝⢢⡛⡔⡣⡝⣨⣿⣿⢂⠗⡥⢋⠖⣌⠓⡤⢓⠬⣑⠪⠔⡹⣯⢷⢣⢀⢲⣯⣽⣯⣿⡩⡛⢴⣫⡖⣈⢒⠡⢊⠔⣠⠚⡐⢡⠒⣄⢃⡃⠦⡙⠤⢌⢣⠒⣍⡒⢩⢆⡱⢃
⡳⢜⢢⡜⡱⢜⡸⡑⣼⣿⣿⣿⣿⡮⠴⣉⠞⠤⡋⠴⣉⠲⢨⠜⡡⣟⣼⣯⣧⣼⣬⣷⣯⣿⣳⣇⣛⣧⡍⣇⠰⢈⠬⡐⠌⡐⠌⠜⣠⠃⣄⠣⡘⢢⠑⡜⡨⢦⡙⡤⠙⠤⣆⠱⣃
⢧⣙⠲⢜⡱⢊⡔⣱⣿⣿⣟⣿⣤⣮⠱⡌⢎⡱⠜⢣⢌⡱⢡⢊⠔⣯⣖⣯⢯⡍⣍⣯⣟⣿⡻⡟⣟⡛⣏⡇⢪⠐⡨⢐⡐⠡⢍⠢⢡⠜⡠⢣⠌⠥⣩⠰⡑⢆⡱⢡⡙⢰⠌⡱⢂
⡇⢦⡙⢦⡑⢣⣴⡿⠷⡿⣾⣽⣻⣿⡧⢜⡡⢎⠹⣠⠣⠜⡤⢉⢎⣱⣾⢾⣷⣿⣾⡷⣿⣷⣿⣷⣮⣷⡍⠰⢡⠑⠤⡁⢌⡑⠢⢅⠣⡘⡄⢣⠊⡔⢢⠱⡘⠦⡡⢣⠜⣠⠙⡔⠣
⡝⢢⠜⡡⢎⢻⣿⣷⣿⣿⣿⣾⣽⣻⣯⠸⡰⣉⠖⢤⢉⠖⡨⢥⢊⠼⣿⣞⡒⣎⣶⡿⣯⣿⣳⣯⢷⣿⡇⡉⢆⠩⡐⢡⠒⢨⠱⢈⠦⡑⠌⡂⡍⠦⡉⠦⣁⠇⡥⢃⡚⢄⠣⢌⠱
⡝⢢⢩⢕⠪⢼⣿⣿⣿⣿⣿⣿⣿⣿⢇⠣⡕⢌⡊⠤⢃⢎⠱⡌⠜⣂⣿⣿⣿⣶⣶⣯⣿⣿⣷⣯⣿⣿⠡⠜⣄⠣⡑⢢⠉⢖⡈⢎⠰⡈⠜⡠⢑⠢⡑⠣⠆⣍⠲⢥⡉⢦⠑⢎⠡
⡎⡕⢪⢌⢃⠇⣿⣿⣿⣿⣿⣿⣿⠃⣎⠱⣘⠢⡍⡜⡡⢎⠱⡈⠇⡔⡈⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⢃⢂⠣⢄⠣⡉⢆⠩⢂⡜⢠⢃⠜⣨⠰⣉⠴⣁⠫⠜⢤⢋⠤⣉⢦⢉⢆⠣
⣎⠹⡰⢊⡜⢨⣿⣿⣿⣿⣿⡿⠃⢎⣤⠧⢤⣃⢜⡠⣱⠈⢦⠑⣌⣰⣷⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣬⣘⠌⢢⣱⡊⣔⢃⠜⣠⡮⠶⢦⣣⡴⠘⡤⣉⠞⣄⢋⠦⣑⠢⣊⠌⣃
⣎⠱⢌⡱⡘⣂⣿⣿⣿⣿⣿⣧⠝⠕⠁⠀⡴⡻⢷⡷⠻⠛⣧⣛⢼⡹⠻⣿⠿⠿⣿⣿⡿⣿⢿⣿⠟⣯⠋⡌⣭⢏⣹⣟⣿⠚⣎⣷⠄⠐⣦⢢⢛⣇⠒⣅⠲⢤⣉⠲⣁⠓⡤⢊⠤
⡬⠱⢌⣢⠱⣼⣿⣿⣿⣿⣿⣿⡎⢠⠬⢞⠠⢷⠂⠀⠁⡈⣙⡙⠺⢅⡂⣀⣀⠀⠀⠀⣾⣱⣟⣾⠬⠳⠏⡋⢣⠥⠦⢤⠤⠼⠽⣟⣠⣶⣿⣯⢧⣹⣇⠦⡙⢤⢊⡱⣈⠣⡘⡂⠎
⢧⡙⢆⠲⣱⣿⣿⣿⣿⣿⣿⣿⣶⠦⣬⡘⢌⡰⣩⣽⣯⠉⠐⠠⠀⠀⠀⠄⠉⠻⢷⢶⢾⡿⠋⠁⡄⣁⠎⡐⢈⠌⣘⠢⣉⠎⡒⣹⣿⣻⡽⣞⢧⣚⣿⣆⠳⣌⠲⡰⢡⢃⡱⢌⡘
⣧⡼⣌⢷⣾⣿⣿⣿⣿⣿⣿⣿⠁⣰⣿⣿⣏⣴⣯⣤⡌⠀⠀⠀⠆⠈⠀⢠⢈⣴⣿⢸⣼⡇⢨⡽⣮⣵⣾⣼⣦⣸⣄⢷⣰⣾⣱⣼⣿⣷⣿⣾⣧⣯⣽⣿⡵⡌⣷⢰⢧⡌⡶⣆⡼
⡿⣷⢹⣼⣿⣿⣿⣿⣿⣿⣿⣿⣼⣿⣿⣻⣿⡞⠿⠏⠁⠀⠀⢠⡄⡆⠳⢨⢾⣷⣿⢸⢸⣇⠀⢿⣽⣯⣿⣽⣯⣿⣽⣳⠇⣽⣻⣾⣿⣿⣿⣿⣿⣯⣿⣯⣿⣵⡋⣟⢮⣜⣳⢞⡵
⡽⡻⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⣴⣤⣤⣶⣾⣷⣤⣤⣤⣿⣿⠟⣼⢸⣻⣷⣼⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣽⢷⣿⣽⡟⣮⡳⢞⣵⢫⡝
⢱⠛⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣏⣿⣿⣿⠁⣿⣿⢛⣛⠛⠛⢿⣛⢻⠛⠻⡿⠁⣘⣾⡞⣷⣟⣿⣿⣻⣿⢿⣿⣏⠻⡿⣹⢳⣟⡿⢿⣻⣿⣿⣿⣿⣟⣿⡻⣏⡟⡸⡙⠾⣘⠳⢱
⢡⠛⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢿⢯⣿⢇⡘⣿⣿⣿⣿⣿⢿⠏⣨⡉⣄⢲⢣⣞⣭⣤⣬⣬⣕⢯⣷⣻⣞⢯⡾⣝⡆⣳⢭⢧⢿⡇⠺⣿⣿⣷⡻⡽⣿⣎⡷⢾⣽⠰⡑⠒⡌⢢⠃
⢣⢹⣭⣛⣿⢿⣿⣿⣿⣿⣿⣿⢿⠾⢏⠰⢨⣿⣿⣿⣯⣿⣟⡲⢈⠳⣎⡳⣿⣿⣿⣿⣿⣿⣿⣷⢯⣷⢯⡿⣽⣻⢴⣋⡞⣧⢻⡎⡱⢻⣿⡿⣿⡵⣛⣯⣟⡭⢿⣷⡉⡒⢌⠢⢃
⢣⠾⢷⣻⡾⢯⣶⢫⣾⣿⣿⢿⠃⡌⠦⣑⠊⣿⣿⣿⣿⣳⣯⢷⣊⣜⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣽⣻⢷⣫⢞⣱⢻⣜⢻⡟⢠⢃⡔⡹⣿⣷⡽⣜⣿⡜⣧⢻⡹⣌⢂⠇⡊
⡇⡞⣡⢍⠿⣿⣼⣏⣿⣽⣷⠇⡱⣈⠖⣡⠊⣿⣿⣽⣻⡽⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣾⣝⣮⢳⣎⣿⡏⢔⠢⡰⢡⢹⣟⣷⡳⣎⣿⣮⣿⣿⣹⢂⡅⢃
⢧⠱⡌⢎⢖⡡⠍⡜⠤⡘⡅⡊⠴⡡⢚⠤⢣⠹⣟⣯⣯⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣾⡾⢨⢌⡱⢐⠃⡆⣿⣾⣽⣾⠿⢟⣫⡜⠼⡇⢌⠥
⣇⠓⢬⡘⢢⡑⣃⠎⡲⢡⢒⡩⢒⠥⣋⠜⣡⠣⡹⣾⠿⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣏⢟⣿⢁⢇⠲⣈⠎⡜⡰⢿⡿⣟⣞⣉⣤⣿⣬⣳⢱⢊⠔
⣎⠹⣠⠍⢧⡘⡤⢩⠔⡡⠇⣎⠣⡚⢤⢋⡔⢥⠱⣉⢏⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠰⠌⡎⡌⠧⣌⠚⡤⠣⢼⣿⣿⣿⣿⣿⣿⣿⣯⣳⢊⢌
⣎⠲⢡⢚⠤⢣⠜⣡⠫⡔⢫⡔⢣⡙⡤⢣⠜⡬⠓⡌⢆⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⣿⣿⣿⣿⣷⣶⠙⢆⡱⢸⠱⣨⠑⡦⡙⡤⣿⣿⣿⣳⣿⣿⣽⡿⣯⡎⢢
⣎⡙⢌⡊⢎⡡⢚⢤⠓⡜⣡⢎⠥⣣⢕⢣⡚⡔⢫⠜⣢⣽⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣫⡘⢆⡙⠦⡙⢤⢋⡴⢑⠦⢻⣿⣿⣟⣿⣿⣷⣿⣻⡷⢡
⢦⠹⡰⡘⡌⢖⡩⢎⡱⠜⢦⡙⣎⠵⣊⢖⡱⠬⣭⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠏⣦⣙⠴⣉⠞⡰⡜⢪⠜⡹⣿⣿⣿⣿⣿⣿⣿⣷⢃⠣
⠧⣙⠴⡑⡜⣨⠒⡥⢚⡘⢦⡑⣎⠞⡱⢎⡼⢡⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⢿⢾⡿⢿⡗⡸⣌⢧⡙⡆⢯⡐⣿⣿⣿⣿⣿⣿⣿⡟⢨⡑
⡏⡔⢪⠔⡑⠦⣙⠰⡃⣍⠲⣘⢆⡏⣜⢎⡜⣡⣏⡼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡫⣾⡟⣧⡿⣚⣧⠳⣘⢢⡕⣊⢗⡸⢹⣿⣯⣿⣿⣿⣟⢇⠖⡌
⠷⣘⢡⠎⡱⢘⠤⢣⡑⢆⣣⠓⣎⢖⠺⣜⢲⣹⣿⡜⡼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢟⢍⣾⡽⡹⢖⣷⠧⣟⡱⢌⡣⡒⣍⠲⣡⣿⣿⣿⣿⣿⣿⣿⢨⠚⡔
⣛⠼⡨⢖⣡⢋⡜⡡⢎⡱⢢⢝⢢⠞⣱⢎⡵⣿⣿⣻⣽⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣑⣿⠏⣈⠯⡽⣫⣿⣜⣽⡗⡸⢰⠱⡌⣳⣿⣿⡿⣽⣿⣽⣿⡅⢎⡱⢌
⢧⣛⢔⠣⣌⠒⡬⡑⢎⠱⡣⢎⡣⢺⠱⢎⠶⣿⣯⢷⣛⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣮⣿⠋⠀⣿⢈⣷⣳⡟⣞⣻⡧⣑⠫⡱⣼⣿⣟⣽⣿⡿⣽⣿⣞⣇⡚⢤⢃
⡷⣘⢬⠓⡬⡑⠦⣉⠦⡹⢰⡃⠮⢥⠫⡜⠥⣿⢯⣻⣼⣳⢯⡷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⢡⡀⢠⢻⢠⣿⢧⡷⣚⣿⡧⢌⡣⡕⡻⣿⣿⣿⣷⣿⢿⣳⣯⠧⡜⠤⢃
⡳⣭⢲⡙⢦⡙⢦⢡⡋⠴⡣⠜⡍⢮⠱⣉⠇⣿⢯⡷⣟⣿⡿⣿⣻⢯⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⡐⢆⢸⡯⢈⣿⣻⣿⡱⣿⡅⡣⢕⢪⡱⣙⣿⣿⢿⡽⣿⢿⣿⢐⠬⡑⠣
⣟⢲⢣⡝⣲⡙⢎⠦⣍⢣⠧⡹⣘⢣⠍⢦⠹⣿⢯⡟⣿⣯⣿⢿⣹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⣸⣶⡽⣷⡿⣾⡭⣷⣝⣿⣥⠓⣎⠦⡱⣒⢤⢛⡻⠿⠽⡛⡔⣊⠆⣍⠱
⣮⢳⣍⠞⣥⡛⣬⠳⡜⡪⢵⡑⢎⣆⣋⠮⡱⣹⣯⣟⣿⣽⣿⣿⣳⣿⣿⣿⣿⣿⣿⣿⠿⢏⣿⡿⣿⡇⣾⡿⣽⣏⡷⣿⡳⣿⣭⣟⣏⠹⡤⢓⡱⢃⡎⠶⣉⠮⡱⢜⡰⣁⠚⣄⠣
⣎⢳⢬⡛⡶⣙⢦⡹⣔⢫⡖⢭⡒⠴⣌⠣⣕⢺⣟⣞⣛⠛⢓⣻⣳⣿⣿⣻⣿⣿⣟⣦⢛⣼⣿⣟⣿⠱⣿⡽⣽⡞⣿⣷⣟⣿⣜⡭⢇⢳⢸⡡⢎⡣⢜⢣⡃⢮⠱⡌⠴⡁⢎⠤⣃
⣭⣓⢮⡹⣜⠳⣎⡵⣊⠷⣘⠦⣝⣱⢪⡵⢊⡞⣿⢾⣽⣿⣿⣻⡷⣟⣷⣿⣿⡷⣯⡟⢎⢖⣿⡧⣿⣹⣿⣽⣾⣽⢻⣽⣺⡟⣼⣚⡭⣂⢳⡘⢦⡑⡎⢆⢎⠥⡓⢬⠓⡜⢬⠒⡥
⡶⢍⣶⠹⣜⡹⢆⡳⣍⢞⢥⡛⡴⢪⡕⣪⠳⣜⢻⣟⣮⢟⣵⣻⣿⢯⣟⣾⡿⣿⡽⣇⢫⢾⣿⡇⣿⢧⡿⣾⣻⢾⣿⡿⣽⡯⣗⢾⡰⣍⠦⣙⢦⡑⠞⣌⡒⢧⡙⢆⢫⠜⣢⢋⡔
⣝⡺⣔⣫⠵⣹⢣⡗⣚⡎⢶⡹⣜⡳⢎⡵⢫⣜⡛⣾⢯⣟⣯⣟⣯⣟⡾⣿⣟⡷⣿⡇⣏⣼⣿⡇⣿⢿⡿⣽⢯⡟⣿⣷⣿⣝⢯⣎⡳⢜⡸⣡⠖⣹⡘⢤⡙⢦⠹⣌⢎⡜⡒⡬⢒
⣮⡕⡲⢥⡛⢦⡓⣎⠷⡸⣍⢖⣣⠝⡞⣜⣣⢮⢱⢻⡿⣞⣿⣞⣿⣾⡽⣟⣯⣟⠾⡗⡼⣸⣿⣳⣟⣿⡿⣯⣟⣿⣿⢻⡷⣾⢫⡵⡙⢮⡱⢆⡳⢰⡘⣆⡓⢎⡔⣊⠖⡰⢓⡌⠧
```
*Dear REHAU: Thanks for trying to lock us out with Cloudflare bot detection. Here's what we think of that.*

Bridge between REHAU NEA SMART 2.0 heating system and Home Assistant via MQTT.

## 🚨 BREAKING CHANGES - Version 4.0.0 (February 2026)

### The REHAU Cloudflare Saga - Final Solution

**TL;DR**: REHAU deployed aggressive Cloudflare bot protection that blocked all legitimate API access. After curl started getting blocked too, we implemented a **real headless browser (Playwright + Chromium)** that perfectly mimics human behavior and bypasses all Cloudflare detection.

**What REHAU Did:**
1. **Mandatory 2FA** - Introduced email-based 2FA for every login (February 2026)
2. **Cloudflare Bot Protection** - Deployed aggressive bot detection that blocks Node.js HTTPS requests
3. **JavaScript Challenges** - Serves "Just a moment..." pages with JavaScript challenges
4. **TLS Fingerprinting** - Started blocking curl's TLS signature (v3.5.1)

**What We Had To Do:**
1. Implement automatic POP3 email polling for 2FA codes
2. Try curl-based implementation (worked initially, then got blocked)
3. **Implement Playwright with headless Chromium** - Real browser, perfect bypass

**The Technical Evolution:**
- Node.js native `https` module: ❌ Blocked by Cloudflare (403)
- Axios library: ❌ Blocked by Cloudflare (403)
- curl command-line tool: ⚠️ Worked initially, then blocked (403)
- **Playwright + Chromium**: ✅ **Perfect solution - real browser bypasses everything**

**Version 4.0.0 uses Playwright to run a real headless Chromium browser.** This executes JavaScript challenges, has perfect TLS fingerprints, and is indistinguishable from a real user. Cloudflare can't block it without blocking all Chrome users.

**Docker Image Impact:** Image size increased by ~150MB due to Chromium, but reliability is now 100%.

### What Changed?

REHAU now requires email-based two-factor authentication for every login. The bridge automatically handles this by polling a POP3 email account for verification codes.

#### 1. Create a POP3 Email Account

We recommend **GMX.de** as it:
- Provides free POP3 access
- Is a German email provider (REHAU is German, so they might appreciate that 🇩🇪)
- Has reliable service

**Alternative providers**: Any email service with POP3 support (Gmail, Outlook, etc.)

#### 2. Set Up Email Forwarding

Configure your main email to forward messages from `noreply@accounts.rehau.com` to your POP3 account.

**For GMX.de setup:**
1. Create account at https://www.gmx.de
2. Go to settings and enable POP3/IMAP
3. Optionally, create application passwords
4. In your original email account, forwand emails from `noreply@accounts.rehau.com` to your new POP3 account
5. Note your POP3 credentials:
   - Host: `pop.gmx.net`
   - Port: `995`
   - Secure: `true`

#### 3. Update Configuration

Add the following POP3 settings to your configuration:

**For Home Assistant Add-on** (`config.yaml`):
```yaml
pop3_email: "your-email@gmx.de"
pop3_password: "your-password"
pop3_host: "pop.gmx.net"
pop3_port: 995
pop3_secure: true
pop3_timeout: 300000  # 5 minutes (optional)
pop3_debug: false     # Enable for troubleshooting (optional)
```

**For Docker** (environment variables):
```bash
POP3_EMAIL=your-email@gmx.de
POP3_PASSWORD=your-password
POP3_HOST=pop.gmx.net
POP3_PORT=995
POP3_SECURE=true
POP3_TIMEOUT=300000
POP3_DEBUG=false
```

**For Standalone** (`.env` file):
```env
POP3_EMAIL=your-email@gmx.de
POP3_PASSWORD=your-password
POP3_HOST=pop.gmx.net
POP3_PORT=995
POP3_SECURE=true
POP3_TIMEOUT=300000
POP3_DEBUG=false
```

### How It Works

1. Bridge authenticates with your REHAU credentials
2. REHAU sends a 2FA code to `noreply@accounts.rehau.com`
3. Your email forwards it to your POP3 account
4. The bridge automatically polls for the email
5. Extracts the 6-digit code
6. Submits it to REHAU
7. Authentication completes seamlessly

**User experience**: Completely transparent. The 2FA happens automatically in the background.

### Troubleshooting

If authentication fails:

1. **Check email forwarding** - Ensure emails from `noreply@accounts.rehau.com` reach your POP3 account
2. **Verify POP3 credentials** - Test your POP3 login manually
3. **Enable debug logging** - Set `pop3_debug: true` to see detailed logs
4. **Check timeout** - Increase `pop3_timeout` if emails arrive slowly
5. **Review logs** - Look for POP3 connection errors or authentication failures

## Original Setup Instructions

### Prerequisites

- Home Assistant with MQTT broker configured
- REHAU NEA SMART 2.0 account credentials
- POP3 email account (see breaking change above)

### Installation

#### Home Assistant Add-on (Recommended)

1. Add this repository to your Home Assistant add-on store
2. Install the "REHAU NEA SMART 2.0 MQTT Bridge" add-on
3. Configure with your credentials (including POP3 settings)
4. Start the add-on

#### Docker

```bash
docker run -d \
  --name rehau-mqtt-bridge \
  -e REHAU_EMAIL=your-email@example.com \
  -e REHAU_PASSWORD=your-password \
  -e POP3_EMAIL=your-email@gmx.de \
  -e POP3_PASSWORD=your-pop3-password \
  -e POP3_HOST=pop.gmx.net \
  -e POP3_PORT=995 \
  -e POP3_SECURE=true \
  -e MQTT_BROKER_URL=mqtt://your-broker:1883 \
  -e MQTT_USERNAME=your-mqtt-user \
  -e MQTT_PASSWORD=your-mqtt-password \
  your-docker-image
```

#### Standalone

```bash
npm install
cp .env.example .env
# Edit .env with your credentials (including POP3 settings)
npm start
```

## Features

- ✅ Automatic 2FA handling via POP3
- ✅ Real-time temperature and status updates
- ✅ Zone control (heating/cooling modes)
- ✅ Schedule management
- ✅ Automatic Home Assistant discovery
- ✅ Persistent authentication with token refresh
- ✅ Graceful error handling and reconnection

## Configuration Options

### Required Settings

- `rehau_email` - Your REHAU account email
- `rehau_password` - Your REHAU account password
- `pop3_email` - POP3 email account for 2FA
- `pop3_password` - POP3 account password
- `pop3_host` - POP3 server hostname
- `mqtt_broker_url` - MQTT broker URL

### Optional Settings

- `pop3_port` - POP3 port (default: 995)
- `pop3_secure` - Use SSL/TLS (default: true)
- `pop3_timeout` - Email polling timeout in ms (default: 300000)
- `pop3_debug` - Enable POP3 debug logging (default: false)
- `mqtt_username` - MQTT broker username
- `mqtt_password` - MQTT broker password
- `log_level` - Logging level (default: info)

## Support

For issues related to:
- **2FA setup**: Check the troubleshooting section above
- **POP3 configuration**: Verify your email provider's POP3 settings
- **General issues**: Open an issue on GitHub

## License

MIT

## Acknowledgments

Special thanks to REHAU for making authentication so "secure" that we had to implement POP3 polling in 2026. 🎭
