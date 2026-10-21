#!/bin/bash
# Genera el sonido de fin de bloque de FOCUS (sintetizado, sin licencias).
# Dos golpes de campana de cristal (mi y sol agudos), de la misma familia que
# la firma de FOCUS de scripts/sonidos-modos.sh, pero más largo: es un aviso.
# Uso: bash scripts/sonidos-focus.sh assets/sonidos/focus <carpeta temporal>
set -e
OUT="$1"
TMP="$2"
SR=44100
D=1.6
CAMPANA_1="(sin(2*PI*1318.5*t)+0.55*sin(2*PI*1977*t)+0.3*sin(2*PI*3295*t)+0.12*sin(2*PI*4613*t)*exp(-8*t))*exp(-3.2*t)*min(1,t/0.004)"
U="(t-0.42)"
CAMPANA_2="gte(t,0.42)*0.9*(sin(2*PI*1568*$U)+0.55*sin(2*PI*2352*$U)+0.3*sin(2*PI*3920*$U)+0.12*sin(2*PI*5488*$U)*exp(-8*$U))*exp(-3.2*$U)*min(1,$U/0.004)"
ffmpeg -hide_banner -loglevel error -y -f lavfi -i "aevalsrc=exprs='$CAMPANA_1 + $CAMPANA_2':s=$SR:d=$D" -af "volume=0.2" -ac 1 "$TMP/tmp_fin.wav"
peak=$(ffmpeg -hide_banner -i "$TMP/tmp_fin.wav" -af volumedetect -f null - 2>&1 | grep max_volume | sed 's/.*max_volume: \(-\?[0-9.]*\) dB/\1/')
gain=$(python -c "print(round(-9 - ($peak), 2))")
ffmpeg -hide_banner -loglevel error -y -i "$TMP/tmp_fin.wav" -af "volume=${gain}dB,afade=t=out:st=1.45:d=0.15" -c:a aac -b:a 96k -ar $SR -ac 1 -movflags +faststart "$OUT/fin.m4a"
echo "fin peak=$peak gain=$gain"
rm -f "$TMP"/tmp_fin.wav
