# REHAU NEA SMART 2.0 MQTT Bridge

```
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣤⣤⣤⣶⣶⣿⣿⣿⣿⣿⣿⣶⣶⣤⣤⣄⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣤⡾⠛⠉⠀⠀⠀⠀⠈⠉⠛⠛⢋⣠⣤⣝⡻⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⠟⠁⠀⠀⠀⠀⣀⣠⣤⣬⣿⣿⣿⣿⣿⣿⣿⣿⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⡿⠃⠀⢀⣠⣤⣼⣿⣿⣿⡿⠿⢿⣿⣿⣿⣿⡘⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⠟⠛⠛⠛⢷⡄⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⠋⠀⠀⣴⣿⣿⡟⠋⣉⣁⣀⣀⣤⣾⣿⣿⡿⠋⠀⠀⠙⣿⣿⣿⣿⣿⣿⣿⣿⡟⠈⢻⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⢸⡇⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡟⠁⠀⠀⠀⠈⠻⣯⣄⣀⠈⠙⠻⣿⣿⣿⡿⠋⠀⠀⠀⠀⠀⠈⠻⣿⣄⠻⣿⣿⣿⡇⠀⣼⣿⣿⣿⣿⣧⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⢿⡀⠀⠀⠀⢸⡇⢸⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡟⠀⢰⣄⣀⠀⢠⣤⣀⠈⠉⠉⠀⠀⠀⠉⠁⠀⠀⣠⣴⣾⣷⣦⡀⠀⠈⢿⣿⣝⣿⣿⡇⠀⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠘⠷⣶⣶⣶⠟⠁⢸⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⠀⠀⣸⣿⣿⣿⣦⠙⠻⢷⣦⣄⠀⢤⣤⣴⣶⣾⣿⣿⣿⣿⣿⣿⣿⣦⡀⠀⠈⠛⠀⠙⠀⠸⣿⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢹⡀⠀⠛⠋⠉⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⢠⣿⣿⣿⠛⠁⠀⠀⠀⠀⠈⠛⢦⠙⠿⣿⣿⣿⣿⣿⣿⡿⠿⠛⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠈⠿⢃⣾⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣧⣀⠈⠛⠛⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠁⠀⠈⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡟⣿⣿⣷⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢻⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣧⣘⠛⠛⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢘⡇⠀⠀⠀⠀⠀⠀⠀⢿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣶⣦⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⡇⠀⣀⣠⣤⣤⡄⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⡇⠈⠛⠛⠛⠟⠂⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣷⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣀⣤⣶⣶⣶⣶⣶⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⠛⠿⣿⣿⣿⠀⠀⠀⠀⠀⠀⢀⣠⣤⣶⣶⣶⣶⣦⣤⣤⣀⠀⠀⠀⠀⠀⢀⣴⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⡇⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣷⣄⠈⢿⣿⡦⠀⠀⠀⣠⣾⡿⠛⠛⣿⣿⣿⣿⣿⣿⣿⣿⠇⠀⠀⠀⢀⣿⣿⣿⣿⠿⣿⣿⡿⠛⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⡶⠾⣿⣿⠀⠀⠀⠀⠀⠀⢸⣇⣀⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⠀⠹⣦⠀⠉⠀⠀⠀⠘⠋⠁⢀⣾⣿⣿⣿⣿⠏⠛⣿⠛⠁⠀⠀⠀⠀⠈⣿⣿⡟⠁⠀⠀⠀⠀⠀⠛⠛⠛⠛⢿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⣴⡏⠁⠀⠀⠈⣿⠀⠀⠀⠀⠀⠀⠈⣿⠛⠛⠋⠙⠻⣦⠀⠀⠀⠀⠀⠀⠀⢉⢰⣤⣿⣧⣰⣧⠀⠀⠀⠀⠀⠉⠉⠉⠀⠀⠀⠀⣼⠟⠀⠀⠀⠀⠀⠀⠀⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢀⡟⠀⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⢿⡇⠀⠀⠀⠀⠸⣧⠀⠀⠀⠀⠀⠀⢸⣼⣿⣿⡈⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⣤⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⢰⣿⠀⠀⠀⠀⠀⠀⠀⠸⣿⡀⠀⠀⠀⠀⢹⣷⠶⠶⢶⣤⡀⠈⢿⡇⠙⠁⠀⠀⢰⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣇⣸⣿⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⡿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⣼⣷⡀⠀⠀⠀⠸⡟⠀⠀⠀⠀⠀⠀⠀⠀⠙⠃⠀⠀⠀⠀⠀⠹⣧⡀⠀⠈⢿⣆⠈⢷⡄⠀⠀⠀⣦⠙⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⠀⠀⠀⠀⠀⠀⠀⠻⠟⠋⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⣴⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⢾⣿⣧⠀⠙⢦⡀⠀⢹⣆⠘⣷⡄⠀⠀⠀⠀⠀⠀⠀⣠⣾⠟⠿⣦⣄⡀⠀⠀⢀⣠⣶⣾⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⣾⣿⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⣰⡟⠉⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠙⢿⡆⠀⠈⠷⣤⣨⣿⠀⠙⣷⡄⠀⠀⠀⠀⠀⣰⣿⡟⠀⠀⠙⢿⣷⣶⣤⣾⣿⣿⣿⣿⣿⣿⣦⡀⠀⠀⠀⠀⢠⣿⣿⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⢀⣼⠏⠀⠀⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠈⠉⠹⣇⠀⠈⠁⠀⠀⠀⠀⢠⣿⣿⠃⠀⠀⠀⠀⠈⠙⠻⢿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⢀⣾⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⣰⣿⡇⠀⠀⠀⢻⡿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⡇⠀⠀⠀⠀⠀⠀⢿⡄⠀⠀⠀⠀⠀⠀⠘⣿⣿⣦⣤⣤⣤⣤⣤⣤⣴⠶⠿⠿⠛⠛⢻⣿⣿⡇⠀⠀⠀⣼⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⣰⣿⣿⠄⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⡆⠀⠀⠀⠀⠀⢠⣿⡇⠀⠀⠀⠀⠀⢀⣾⣷⡀⠀⠀⠀⠀⠀⠀⠈⠙⠻⣿⣧⣤⣀⣀⣀⣀⣀⣀⣠⣴⣾⣿⣿⣿⠃⠀⠀⠀⣿⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⢠⣿⠛⠀⠀⠀⠀⠀⣼⡇⠀⠀⠀⠀⠀⠀⠀⢸⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠘⢻⣿⠀⠀⠀⢀⣴⣿⣿⡟⢿⣄⠀⠀⠀⠀⠀⠀⠀⠀⠈⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⢻⣿⠀⠀⠀⢸⣿⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⢻⡄⠀⠀⠀⠀⠀⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⢻⡆⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⢸⡇⠀⣠⣴⣿⣿⣿⣿⡇⠈⠻⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠻⢿⣿⣿⣿⣿⣿⡿⠋⣰⣿⡟⠀⠀⠀⣸⣿⣿⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⢻⡀⠀⠀⠀⣰⣿⠇⠀⠀⠀⠀⠀⠀⠀⠀⠘⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⢸⣷⣾⣿⣿⣿⣿⣿⣿⣷⠀⠀⠈⠻⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⣦⣌⣉⣁⣀⣀⣤⣴⣿⡿⠁⠀⠀⢠⣿⡟⠀⠻⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠈⣷⠀⠀⠀⠘⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢿⠆⠀⠀⠀⠀⠀⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣇⠀⠀⠀⠈⠻⣦⡀⠀⠀⠀⠀⠀⠀⠀⠙⠻⠿⠿⠿⠟⠋⠁⠀⠀⠀⠀⣾⣿⠇⠀⠀⠙⢷⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⢸⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠈⠻⣶⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⠂⠀⠀⠀⠀⠈⠻⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⣿⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀⠙⢷⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣠⡾⠛⠀⣾⡁⢀⡀⠀⠀⠀⠀⠹⣿⣦⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢻⡄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄⠀⠀⠀⠀⠀⠀⠈⠛⠷⣤⣄⣀⣠⣤⣤⣤⣶⡾⠛⠉⠀⠀⢰⣿⣷⣾⣿⣷⣤⣀⠀⠀⠹⣿⣿⣿⣿⣶⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠘⢷⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠉⠉⠉⣛⣿⣿⣿⣷⣦⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⣀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠙⠷⣄⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡝⢿⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⡿⠛⠉⠉⠛⢿⣿⣿⣿⣿⣿⣿⡇⠈⠻⢿⠇⠈⢻⣿⣿⣿⣿⣿⣿⣿⣿⣷⣦⡀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠈⠛⢦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠹⣿⣦⡀⠀⠀⠀⠀⠀⠀⠀⣴⣿⣿⣷⣤⣤⣶⠶⠻⠿⠿⣿⣿⣿⣿⣇⠀⠀⠀⠀⠀⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠹⣦⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣰⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠘⢿⣿⣦⡀⠀⠀⠀⢠⣾⣿⠿⢿⣿⣿⣿⣥⣤⣤⣤⣄⣀⠉⠙⢿⡧⠀⠀⠀⠀⠀⠀⠀⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢷⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢠⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⠈⢻⣿⣿⣦⣤⣴⣿⠟⠁⠀⠀⠈⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⠀⠀⠀⠀⠀⠀⠀⠘⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⠳⣦⣄⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢨⣿⡿⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠙⢿⣿⣿⡿⠋⠀⠀⠀⠀⠀⠀⠀⠉⠻⣷⣄⣈⠉⠉⠛⣿⡇⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⡀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⢿⣿⡟⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣠⣾⡿⠛⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣄⠀⠙⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⣿⣿⣿⣿⣿⣷⡀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⣿⣿⡄⠀⠀⠀⠀⠀⠀⠀⢀⣠⣴⠾⠛⠁⠀⠀⢀⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⠿⠛⣻⣆⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡄
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⣿⣿⡇⠀⠀⢀⣀⣠⣴⠾⠛⠉⠀⠀⠀⠀⢀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢰⣿⡿⠋⢁⣠⣾⣿⣿⣷⡀⠀⠀⠀⠀⠀⠈⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣴⠛⣽⣿⣿⣿⣿⣿⠛⠋⠉⠀⠀⠀⠀⠀⠀⢠⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⡟⠀⣴⣿⣿⣿⣿⡟⠛⣷⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠁
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣸⣿⣾⡿⠿⠛⠋⠉⠀⠀⠀⠀⠀⠀⢀⣠⣴⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣾⣇⣴⣿⣿⣿⠟⠉⠀⣠⣾⣷⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⡿⠛⠉⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣴⠾⠛⠋⠁⠀⠀⠀⠀⠀⢀⣀⣤⣴⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⡿⠁⠀⢠⣾⣿⣿⣿⣧⡀⠀⠀⠀⠈⣿⣿⣿⠿⠛⠉⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢀⣾⡇⠀⠀⠀⢀⣀⣤⣤⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⣀⣀⣀⣀⣠⣤⣤⣴⣿⣿⣿⣿⡄⢀⣴⣿⣿⣿⣿⣿⣿⣷⡀⠀⢀⣼⡿⠛⠁⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣧⣴⣶⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠛⠛⠛⠉⠉⠁⠀⠀⠀⠀⠀⠀⠉⠙⠻⠿⣿⣿⣿⣿⣿⣿⣿⣿⡷⠞⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠿⠛⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠉⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠟⠛⠋⠉⠛⠿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠋⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠟⠉⠀⠀⠀⠀⠀⠀⠀⠀⠈⠻⢿⣿⣿⣿⣿⣿⣿⡿⠿⠟⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠿⠟⠋⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠈⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠙⢿⣿⣿⣿⣿⣿⠿⠟⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠉⠉⠉⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
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

*Settings View*
- Complete configuration display
- Masked sensitive data
- System diagnostics

### Installation as PWA

**iOS (Safari)**:
1. Open web UI in Safari
2. Tap Share button
3. Select "Add to Home Screen"
4. Tap "Add"

**Android (Chrome)**:
1. Open web UI in Chrome
2. Tap menu (⋮)
3. Select "Install app" or "Add to Home screen"
4. Tap "Install"

**Desktop (Chrome/Edge)**:
1. Open web UI
2. Click install icon in address bar
3. Click "Install"

---

## 🏠 Home Assistant Integration

### Auto-Discovery

The bridge automatically creates Home Assistant entities via MQTT discovery:

**Climate Entities** (one per zone):
```yaml
climate.rehau_zone_name:
  temperature: 21.5
  target_temperature: 22.0
  current_temperature: 21.5
  hvac_mode: heat
  preset_mode: comfort
  hvac_modes: [heat, cool, off]
  preset_modes: [comfort, eco, away, home]
```

**Sensors**:
- `sensor.rehau_bridge_status` - Bridge connection status
- `sensor.rehau_auth_status` - Authentication status
- `sensor.rehau_mqtt_quality` - MQTT connection quality
- `sensor.rehau_session_age` - Time since last authentication
- `sensor.rehau_outside_temperature` - Outside temperature

**Binary Sensors**:
- `binary_sensor.rehau_zone_name_stale` - Data staleness indicator

### Example Automations

**Automatic Night Mode**:
```yaml
automation:
  - alias: "REHAU Night Mode"
    trigger:
      - platform: time
        at: "22:00:00"
    action:
      - service: climate.set_preset_mode
        target:
          entity_id: climate.rehau_living_room
        data:
          preset_mode: eco
```

**Temperature Alert**:
```yaml
automation:
  - alias: "REHAU Temperature Alert"
    trigger:
      - platform: numeric_state
        entity_id: climate.rehau_bedroom
        attribute: current_temperature
        below: 18
    action:
      - service: notify.mobile_app
        data:
          message: "Bedroom temperature is below 18°C"
```

**Stale Data Refresh**:
```yaml
automation:
  - alias: "REHAU Refresh Stale Data"
    trigger:
      - platform: state
        entity_id: binary_sensor.rehau_living_room_stale
        to: "on"
    action:
      - service: mqtt.publish
        data:
          topic: "rehau/command/refresh"
          payload: "true"
```

---

## 🔧 Troubleshooting

### Common Issues

#### Authentication Fails
```
❌ Problem: "Authentication failed" or "Invalid credentials"
✅ Solution:
  1. Verify REHAU credentials are correct
  2. Check if 2FA is enabled (POP3 required)
  3. Ensure POP3 credentials are correct
  4. Check email for 2FA codes
  5. Review logs for specific error messages
```

#### MQTT Connection Issues
```
❌ Problem: "MQTT connection failed" or "Connection refused"
✅ Solution:
  1. Verify MQTT broker is running
  2. Check MQTT_HOST and MQTT_PORT settings
  3. Verify MQTT credentials if authentication enabled
  4. Check firewall rules
  5. Test MQTT broker with mosquitto_pub/sub
```

#### Browser/Playwright Issues
```
❌ Problem: "Browser launch failed" or high memory usage
✅ Solution:
  1. Ensure Chromium dependencies installed
  2. Increase memory allocation (4GB recommended)
  3. Set PLAYWRIGHT_HEADLESS=true
  4. Adjust PLAYWRIGHT_IDLE_TIMEOUT
  5. Check system resources (RAM, CPU)
```

#### Web UI Not Loading
```
❌ Problem: "Cannot access web UI" or blank page
✅ Solution:
  1. Verify API_ENABLED=true and WEB_UI_ENABLED=true
  2. Check port 3000 is not in use
  3. Review browser console for errors
  4. Clear browser cache
  5. Check API logs for errors
```

#### Zones Not Updating
```
❌ Problem: Zone data is stale or not updating
✅ Solution:
  1. Check staleness sensors in Home Assistant
  2. Verify MQTT connection quality
  3. Review authentication status
  4. Check for rate limiting
  5. Manually trigger refresh via API
```

### Debug Mode

Enable detailed logging:
```env
LOG_LEVEL=debug
LOG_SHOW_OK_REQUESTS=true
```

View logs:
```bash
# Docker
docker logs rehau-bridge -f

# Home Assistant Addon
# Check addon logs in UI

# Standalone
npm start
```

### Health Check

```bash
# Check system health
curl http://localhost:3000/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2026-02-22T10:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "used": 120,
    "total": 4096
  }
}
```

### Log Export

Export logs for troubleshooting:
```bash
# Via API
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/api/v1/logs/export?mode=shareable

# Via Web UI
# Navigate to Logs page → Click "Export" button
```

---

## 📚 Documentation

### Core Documentation
- **[CHANGELOG.md](CHANGELOG.md)** - Version history and changes
- **[.env.example](.env.example)** - Complete configuration reference
- **[DOCKER_GUIDE.md](DOCKER_GUIDE.md)** - Docker deployment guide
- **[FEATURE_IMPLEMENTATION_SUMMARY.md](FEATURE_IMPLEMENTATION_SUMMARY.md)** - Technical feature details

### Setup Guides
- **[docs/oauth2-setup.md](docs/oauth2-setup.md)** - OAuth2 setup (with limitations)
- **[docs/OAUTH2_GMAIL_SETUP.md](docs/OAUTH2_GMAIL_SETUP.md)** - Gmail OAuth2 guide
- **[docs/OAUTH2_OUTLOOK_SETUP.md](docs/OAUTH2_OUTLOOK_SETUP.md)** - Outlook OAuth2 guide

### API Documentation
- **Swagger UI**: http://localhost:3000/api-docs
- **OpenAPI Spec**: http://localhost:3000/api-docs.json

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Development Setup

```bash
# Clone repository
git clone https://github.com/manuxio/rehau-nea-smart-2-home-assistant.git
cd rehau-nea-smart-2-home-assistant/rehau-nea-smart-mqtt-bridge

# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your credentials

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

### Code Style

- **TypeScript** with strict mode
- **ESLint** for code quality
- **Prettier** for formatting
- **Conventional Commits** for commit messages

---

## 🐛 Bug Reports

Found a bug? Please open an issue with:

1. **Description** of the problem
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Environment** (OS, Node.js version, Docker version)
6. **Logs** (use shareable export mode)

**⚠️ Important**: Use shareable log export to remove sensitive data before sharing logs.

---

## 💡 Feature Requests

Have an idea? Open an issue with:

1. **Feature description**
2. **Use case** and benefits
3. **Proposed implementation** (if applicable)
4. **Alternatives considered**

---

## 📊 Project Status

### Current Version: 5.0.0

**Status**: ✅ Production Ready

**Stability**: 
- Core MQTT Bridge: ✅ Stable
- REST API: ✅ Stable
- Web UI: ✅ Stable
- OAuth2: ⚠️ Incomplete (use basic auth)

**Tested On**:
- ✅ Home Assistant 2024.1+
- ✅ Raspberry Pi 4 (4GB RAM)
- ✅ Docker 24.0+
- ✅ Node.js 20.x
- ✅ Ubuntu 22.04, Debian 12
- ✅ Windows 11, macOS 14

---

## 🗺️ Roadmap

### v5.1.0 (Q2 2026)
- [ ] Complete OAuth2 implementation with automatic flow
- [ ] WebSocket real-time updates for live data
- [ ] Historical data graphs with Chart.js
- [ ] Push notifications for alerts
- [ ] Advanced scheduling interface

### v5.2.0 (Q3 2026)
- [ ] React Native mobile app
- [ ] GraphQL API option
- [ ] Advanced analytics and reporting
- [ ] Backup/restore functionality
- [ ] Theme customization

### v6.0.0 (Q4 2026)
- [ ] Multi-user support with roles
- [ ] Advanced automation engine
- [ ] Energy monitoring integration
- [ ] Weather-based optimization
- [ ] Machine learning temperature predictions

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **REHAU** for the NEA SMART 2.0 heating system
- **Home Assistant** community for inspiration
- **Playwright** team for browser automation
- **React** and **TypeScript** communities
- All contributors and users

---

## 📞 Support

### Community Support
- **GitHub Issues**: [Report bugs or request features](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/discussions)

### Documentation
- **API Docs**: http://localhost:3000/api-docs
- **Changelog**: [CHANGELOG.md](CHANGELOG.md)
- **Configuration**: [.env.example](.env.example)

### Quick Links
- **Repository**: https://github.com/manuxio/rehau-nea-smart-2-home-assistant
- **Issues**: https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues
- **Releases**: https://github.com/manuxio/rehau-nea-smart-2-home-assistant/releases

---

## ⚡ Quick Reference

### Essential Commands

```bash
# Docker
docker build -t rehau-bridge .
docker run -d --name rehau-bridge -p 3000:3000 --env-file .env rehau-bridge
docker logs rehau-bridge -f
docker restart rehau-bridge

# Node.js
npm install
npm run build
npm start
npm run dev

# Health Check
curl http://localhost:3000/health

# API Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your_password"}'
```

### Essential URLs

- **Web UI**: http://localhost:3000
- **API Docs**: http://localhost:3000/api-docs
- **Health**: http://localhost:3000/health
- **Logs**: http://localhost:3000/logs

### Essential Environment Variables

```env
REHAU_EMAIL=your.email@example.com
REHAU_PASSWORD=your_password
POP3_EMAIL=your.email@gmx.com
POP3_PASSWORD=your_pop3_password
MQTT_HOST=localhost
API_PASSWORD=your_secure_password
```

---

<div align="center">

**Made with ❤️ for the Home Assistant community**

⭐ **Star this repo** if you find it useful!

[Report Bug](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues) • [Request Feature](https://github.com/manuxio/rehau-nea-smart-2-home-assistant/issues) • [Documentation](CHANGELOG.md)

</div>
