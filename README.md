# SillyTavern - Message Variables

Adds variables specific to a message (and swipe).

Writes a copy of the message variables to chat variables.

```stscript
/setmesvar key=x foo |
/getmesvar x |
/echo mesvar x: {{pipe}} |
/getvar x |
/echo chatvar x: {{pipe}} |
```

```stscript
/getmesvar mes=-2 x |
/echo mesvar from previous message: {{pipe}}
```

```stscript
/getmesvar mes=0 x |
/echo mesvar from first message: {{pipe}}
```

```stscript
/getmesvars |
/echo mes vars from last message: {{pipe}}
```
