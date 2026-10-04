(()=>{
const canvas=document.getElementById('view');
const ctx=canvas.getContext('2d');
const gammaEl=document.getElementById('gamma');
const gammaVal=document.getElementById('gammaVal');
const expEl=document.getElementById('exposure');
const expVal=document.getElementById('exposureVal');
const modeText=document.getElementById('modeText');
const leftText=document.getElementById('leftText');
const formula=document.getElementById('formula');
const leftTitle=document.getElementById('leftTitle');

let mode='gray', gamma=2.2, exposure=1.0;

document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  b.classList.add('active');
  mode=b.dataset.mode;
  draw();
});
gammaEl.oninput=()=>{gamma=+gammaEl.value;gammaVal.textContent=gamma.toFixed(2);draw();};
expEl.oninput=()=>{exposure=+expEl.value;expVal.textContent=exposure.toFixed(2);draw();};

function encode(x){return Math.pow(Math.max(0,x),1/gamma);}
function display(x){return Math.pow(Math.max(0,x),gamma);}
function byte(v){return Math.max(0,Math.min(255,Math.round(v*255)));}
function clear(){ctx.fillStyle='#10131a';ctx.fillRect(0,0,canvas.width,canvas.height);}
function label(t,x,y,a='left'){ctx.fillStyle='#e8edf5';ctx.font='20px system-ui';ctx.textAlign=a;ctx.fillText(t,x,y);}
function small(t,x,y,a='left'){ctx.fillStyle='#aab4c3';ctx.font='15px system-ui';ctx.textAlign=a;ctx.fillText(t,x,y);}

function drawGray(){
  clear();
  const mid=canvas.width/2, top=70, h=380;
  label('Linear 直接送显示端',mid/2,40,'center');
  label('Linear → sRGB encode → 显示',mid+mid/2,40,'center');

  for(let x=0;x<mid;x++){
    const linear=x/(mid-1);
    const left=display(linear)*exposure;
    const right=display(encode(linear))*exposure;

    ctx.fillStyle='rgb('+byte(left)+','+byte(left)+','+byte(left)+')';
    ctx.fillRect(x,top,1,h);

    ctx.fillStyle='rgb('+byte(right)+','+byte(right)+','+byte(right)+')';
    ctx.fillRect(mid+x,top,1,h);
  }

  ctx.strokeStyle='#d7a62a';ctx.lineWidth=3;
  ctx.beginPath();ctx.moveTo(mid*.5,top);ctx.lineTo(mid*.5,top+h);ctx.stroke();
  ctx.beginPath();ctx.moveTo(mid+mid*.5,top);ctx.lineTo(mid+mid*.5,top+h);ctx.stroke();

  small('linear = 0.5',mid*.5,480,'center');
  small('linear = 0.5',mid+mid*.5,480,'center');

  leftTitle.textContent='Linear value → display';
  leftText.textContent='0 和 1 两端基本不受影响，差异集中在中间亮度。linear 0.5 直接显示会被压暗；先编码后再显示，能恢复到期望亮度。';
  formula.textContent='display = input^gamma\nencoded = linear^(1/gamma)';
  modeText.textContent='当前 gamma = '+gamma.toFixed(2)+'。左边没有输出校正，右边在最终显示前做逆 Gamma 编码。';
}

function drawLight(){
  clear();
  const mid=canvas.width/2, top=80, bottom=450;
  label('旧工作流：1 / distance',mid/2,40,'center');
  label('Linear 工作流：1 / distance²',mid+mid/2,40,'center');

  for(let side=0;side<2;side++){
    const ox=side*mid;
    for(let x=0;x<mid;x++){
      const nx=x/(mid-1);
      const d=.35+nx*5.2;
      let linear=side===0 ? 1/d : 1/(d*d);
      linear=Math.min(1,linear*exposure);

      const shown=side===0 ? display(linear) : display(encode(linear));
      const grad=ctx.createLinearGradient(0,top,0,bottom);
      grad.addColorStop(0,'rgb('+byte(shown*.9)+','+byte(shown*.7)+','+byte(shown*.3)+')');
      grad.addColorStop(1,'rgb('+byte(shown*.18)+','+byte(shown*.13)+','+byte(shown*.055)+')');
      ctx.fillStyle=grad;
      ctx.fillRect(ox+x,top,1,bottom-top);
    }
  }

  small('near',20,485);
  small('far',mid-20,485,'right');
  small('near',mid+20,485);
  small('far',canvas.width-20,485,'right');

  leftTitle.textContent='Light attenuation';
  leftText.textContent='没有正确 Gamma 工作流时，平方衰减会被显示响应再次压暗，看起来衰减过快，因此旧场景常用 1/distance 取得视觉补偿。';
  formula.textContent='legacy: 1 / d\nlinear workflow: 1 / d²\nfinal output: pow(color, 1/gamma)';
  modeText.textContent='右边保持在线性空间计算 1/d²，只在最后编码；这对应官方示例开启 Gamma 后使用的衰减。';
}

function drawTexture(){
  clear();
  const mid=canvas.width/2, top=70, h=390;
  label('sRGB 值直接参与 Lighting',mid/2,40,'center');
  label('sRGB decode → Linear Lighting',mid+mid/2,40,'center');

  for(let y=0;y<h;y++){
    for(let x=0;x<mid;x+=2){
      const u=x/mid, v=y/h;
      const grain=.5+.5*Math.sin(u*60+Math.sin(v*11)*2.5);
      const stored=.18+.62*grain;
      const light=.25+.75*(1-u);

      const wrong=Math.min(1,stored*light*exposure);

      const decoded=Math.pow(stored,gamma);
      const lit=Math.min(1,decoded*light*exposure);
      const correct=encode(lit);

      ctx.fillStyle='rgb('+byte(wrong*.95)+','+byte(wrong*.52)+','+byte(wrong*.18)+')';
      ctx.fillRect(x,top,2,h);

      ctx.fillStyle='rgb('+byte(correct*.95)+','+byte(correct*.52)+','+byte(correct*.18)+')';
      ctx.fillRect(mid+x,top,2,h);
    }
  }

  leftTitle.textContent='sRGB texture input';
  leftText.textContent='Albedo / diffuse 这类颜色纹理通常需要先解码到线性空间；normal、roughness、metallic 等数据纹理不应该套用 sRGB 解码。';
  formula.textContent='linearTex = srgbTex^gamma\nlighting in linear\noutput = color^(1/gamma)';
  modeText.textContent='两边使用同一组存储值。右边先把颜色纹理解码到 Linear，再做乘法，最后重新编码。';
}

function draw(){
  if(mode==='gray')drawGray();
  else if(mode==='light')drawLight();
  else drawTexture();
}
draw();
})();