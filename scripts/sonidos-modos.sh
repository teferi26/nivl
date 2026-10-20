#!/bin/bash
# Genera las firmas de sonido de los modos (sintetizadas, sin licencias).
set -e
# Uso: bash scripts/sonidos-modos.sh assets/sonidos/modos <carpeta temporal>
OUT="$1"
TMP="$2"
SR=44100
gen() { # nombre duracion expresion [filtros]
  local n=$1 d=$2 e=$3 f=${4:-anull}
  ffmpeg -hide_banner -loglevel error -y -f lavfi -i "aevalsrc=exprs='$e':s=$SR:d=$d" -af "volume=0.2,$f" -ac 1 "$TMP/tmp_$n.wav"
  local peak
  peak=$(ffmpeg -hide_banner -i "$TMP/tmp_$n.wav" -af volumedetect -f null - 2>&1 | grep max_volume | sed 's/.*max_volume: \(-\?[0-9.]*\) dB/\1/')
  local gain
  gain=$(python -c "print(round(-9 - ($peak), 2))")
  local st
  st=$(python -c "print(round($d-0.04,3))")
  ffmpeg -hide_banner -loglevel error -y -i "$TMP/tmp_$n.wav" -af "volume=${gain}dB,afade=t=out:st=$st:d=0.04" -c:a aac -b:a 96k -ar $SR -ac 1 -movflags +faststart "$OUT/$n.m4a"
  echo "$n peak=$peak gain=$gain"
}
# NIVL: gong corto (parciales inarmonicos graves, caida lenta)
gen general 0.58 "(sin(2*PI*110*t)+0.6*sin(2*PI*163*t)+0.45*sin(2*PI*231*t)+0.3*sin(2*PI*298*t)+0.2*sin(2*PI*407*t)+0.12*sin(2*PI*622*t))*exp(-4.5*t)*min(1,t/0.006)"
# IRON: disco que se desliza (ruido) y clank metalico seco con golpe grave
gen iron 0.46 "0.5*(2*random(0)-1)*exp(-30*t)*lt(t,0.12) + gte(t,0.13)*((sin(2*PI*523*(t-0.13))+0.7*sin(2*PI*1187*(t-0.13))+0.5*sin(2*PI*1873*(t-0.13))+0.35*sin(2*PI*2651*(t-0.13))+0.2*sin(2*PI*3517*(t-0.13)))*exp(-22*(t-0.13)) + 1.2*sin(2*PI*72*(t-0.13))*exp(-18*(t-0.13)))" "highpass=f=40"
# FOCUS: campana de cristal (agudos puros, ataque suave, cola limpia)
gen focus 0.58 "(sin(2*PI*1568*t)+0.5*sin(2*PI*2352*t)+0.35*sin(2*PI*3920*t)+0.15*sin(2*PI*5488*t)*exp(-6*t))*exp(-5.5*t)*min(1,t/0.004)"
# WORK: interruptor (dos clics secos)
gen work 0.16 "(2*random(0)-1)*(exp(-900*t)+0.7*gte(t,0.055)*exp(-1100*(t-0.055))) + 0.6*sin(2*PI*2200*t)*exp(-400*t)" "highpass=f=900"
# FOUNDER: ignicion (ruido y diente grave que sube y arranca)
gen founder 0.58 "(0.6*(2*random(0)-1)*(0.4+0.6*sin(2*PI*(28+90*t)*t)^2) + 0.8*sin(2*PI*(45*t+110*t*t)))*min(1,t/0.18)*exp(-2.2*t)" "lowpass=f=1800,highpass=f=35"
rm -f "$TMP"/tmp_*.wav
