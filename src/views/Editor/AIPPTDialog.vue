<template>
  <div class="aippt-dialog">
    <div class="header">
      <span class="title">AIPPT</span>
      <span class="subtitle" v-if="step === 'template'">从下方挑选合适的模板，开始生成PPT</span>
      <span class="subtitle" v-else-if="step === 'outline'">确认下方内容大纲（点击编辑内容，右键添加/删除大纲项），开始选择模板</span>
      <span class="subtitle" v-else>在下方输入您的PPT主题，并适当补充信息，如行业、岗位、学科、用途等</span>
    </div>

    <template v-if="step === 'setup'">
      <Input class="input" ref="inputRef" v-model:value="keyword" :maxlength="50" placeholder="请输入PPT主题，如：大学生的应用" @enter="createOutline()">
        <template #suffix>
          <span class="count">{{ keyword.length }} / 50</span>
          <span class="language" v-tooltip="'切换语言'" @click="language = language === 'zh' ? 'en' : 'zh'">{{ language === 'zh' ? '中' : '英' }}</span>
          <div class="submit" type="primary" @click="createOutline()">
            <IconSend class="icon" />AI 生成
          </div>
        </template>
      </Input>
      <div class="recommends">
        <div class="recommend" v-for="(item, index) in recommends" :key="index" @click="setKeyword(item)">{{ item }}</div>
      </div>
    </template>
    <div class="preview" v-if="step === 'outline'">
      <pre ref="outlineRef" v-if="outlineCreating">{{ outline }}</pre>
      <div class="outline-view" v-else>
        <OutlineEditor v-model:value="outline" />
      </div>
      <div class="btns" v-if="!outlineCreating">
        <Button class="btn" type="primary" @click="step = 'template'">选择模板</Button>
        <Button class="btn" @click="outline = ''; step = 'setup'">返回重新生成</Button>
      </div>
    </div>
    <div class="select-template" v-if="step === 'template'">
      <div class="templates">
        <div
          class="template"
          :class="{ 'selected': selectedTemplate === template.id }"
          v-for="template in templates"
          :key="template.id"
          @click="selectedTemplate = template.id"
        >
          <img :src="template.cover" :alt="template.name" />
        </div>
      </div>
      <div class="btns">
        <Button class="btn" type="primary" @click="createPPT()">生成</Button>
        <Button class="btn" @click="step = 'outline'">返回大纲</Button>
      </div>
    </div>

    <FullscreenSpin :loading="loading" tip="AI生成中，请耐心等待 ..." />
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import api from '@/services';
import useAIPPT from '@/hooks/useAIPPT';
import type { AIPPTSlide } from '@/types/AIPPT';
import type { Slide } from '@/types/slides';
import message from '@/utils/message';
import { useMainStore, useSlidesStore } from '@/store';
import Input from '@/components/Input.vue';
import Button from '@/components/Button.vue';
import Select from '@/components/Select.vue';
import FullscreenSpin from '@/components/FullscreenSpin.vue';
import OutlineEditor from '@/components/OutlineEditor.vue';

const mainStore = useMainStore();
const { templates } = storeToRefs(useSlidesStore());
const { AIPPT } = useAIPPT();

const language = ref<'zh' | 'en'>('zh');
const keyword = ref('');
const outline = ref('');
const selectedTemplate = ref('template_1');
const loading = ref(false);
const outlineCreating = ref(false);
const outlineRef = ref<HTMLElement>();
const inputRef = ref<InstanceType<typeof Input>>();
const step = ref<'setup' | 'outline' | 'template'>('setup');
const model = ref('ark-deepseek-v3');
const currentContentPosition = ref(0);
const content = ref('');
const recommends = ref([
  '大模型的最新发展与应用',
  '中学生睡眠调查与研究',
  '大学生职业生涯规划',
  '大数据如何改变世界',
  'AIGC在教育领域的应用',
  '年度工作总结与展望'
]);

onMounted(() => {
  setTimeout(() => {
    inputRef.value!.focus();
  }, 500);
});

const setKeyword = (value: string) => {
  keyword.value = value;
  inputRef.value!.focus();
};

const createOutline = async () => {
  if (!keyword.value) return message.error('请先输入PPT主题');

  loading.value = true;
  outlineCreating.value = true;

  const stream = await api.AIPPT_Outline(keyword.value, language.value, model.value);
  if (!stream.ok) {
    loading.value = false;
    throw new Error('访问远程服务器出错');
  }

  loading.value = false;
  step.value = 'outline';

  const reader: ReadableStreamDefaultReader = stream.body.getReader();
  const decoder = new TextDecoder('utf-8');

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      outlineCreating.value = false;
      break;
    }
    let parseMessage: any;
    let chunk: any;
    chunk += decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');
    lines.forEach((line: string) => {
      if (!line || !line.startsWith('data:')) {
        return;
      }
      try {
        parseMessage = JSON.parse(line.substring(6));
      } catch (error) {
        return;
      }
      if (parseMessage.event === 'message') {
        outline.value += parseMessage.answer;
      }
      nextTick(() => {
        if (outlineRef.value) {
          outlineRef.value.scrollTop = outlineRef.value.scrollHeight + 20;
        }
      });
    });
  }
};

const parsePPTObject = (templateSlides: Slide[]) => {
  let i = 0;
  let objectDepth = 0;
  let currentObjectStart = 0;
  let tempContent = '';
  if (currentContentPosition.value > 0) {
    let tempChar = content.value.substring(currentContentPosition.value, currentContentPosition.value + 1);
    if (tempChar === '}') {
      currentContentPosition.value++;
      tempChar = content.value.substring(currentContentPosition.value, currentContentPosition.value + 1);
    }
    if (tempChar === ',') {
      currentContentPosition.value++;
    }
    tempContent = content.value.substring(currentContentPosition.value);
  } else {
    tempContent = content.value;
  }

  while (i < tempContent.length) {
    const char = tempContent[i];
    // 处理非字符串内容
    if (char === '{') {
      if (objectDepth === 0) {
        currentObjectStart = i;
      }
      objectDepth++;
    } else if (char === '}') {
      objectDepth--;
      // 当一个完整的JSON对象解析完成
      if (objectDepth === 0) {
        const jsonStr = tempContent.substring(currentObjectStart, i + 1);
        try {
          const jsonObj = JSON.parse(jsonStr);
          // 只处理包含type属性的对象
          if (jsonObj.hasOwnProperty('type')) {
            currentContentPosition.value = currentContentPosition.value + i;
            AIPPT(templateSlides, [jsonObj]);
          }
        } catch (e) {
          // 解析错误，可能是不完整的JSON
          console.error('JSON解析错误:', e);
          i++;
        }
      }
    }
    i++;
  }
};

const createPPT = async () => {
  loading.value = true;

  const templateSlides: Slide[] = await api.getFileData(selectedTemplate.value).then(ret => ret.slides);
  const stream = await api.AIPPT(outline.value, language.value, 'doubao-1.5-pro-32k');
  if (!stream.ok) {
    loading.value = false;
    throw new Error('访问远程服务器出错');
  }

  const reader: ReadableStreamDefaultReader = stream.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let parseMessage: any;
  let unprocessedBuffer: any;
  content.value = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      loading.value = false;
      // mainStore.setAIPPTDialogState(false);
      break;
    }

    unprocessedBuffer += decoder.decode(value, { stream: true });
    const lines = unprocessedBuffer.split('\n');
    lines.forEach((line: string) => {
      if (!line || !line.startsWith('data:')) {
        return;
      }
      try {
        parseMessage = JSON.parse(line.substring(6));
      } catch (error) {
        return;
      }
      if (parseMessage.event === 'message') {
        content.value += parseMessage.answer;
        parsePPTObject(templateSlides);
      }
    });
    unprocessedBuffer = lines[lines.length - 1];
  }
};
</script>

<style lang="scss" scoped>
.aippt-dialog {
  margin: -20px;
  padding: 30px;
}
.header {
  margin-bottom: 12px;

  .title {
    font-weight: 700;
    font-size: 20px;
    margin-right: 8px;
    background: #53a8ff;
    background-clip: text;
    color: transparent;
    vertical-align: text-bottom;
    line-height: 1.1;
  }
  .subtitle {
    color: #888;
    font-size: 12px;
  }
}
.preview {
  pre {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .outline-view {
    max-height: 450px;
    padding: 10px;
    margin-bottom: 15px;
    background-color: #f1f1f1;
    overflow: auto;
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}
.select-template {
  .templates {
    display: flex;
    margin-bottom: 10px;
    @include flex-grid-layout();

    .template {
      border: 2px solid $borderColor;
      border-radius: $borderRadius;
      width: 304px;
      height: 172.75px;
      margin-bottom: 12px;

      &:not(:nth-child(2n)) {
        margin-right: 12px;
      }

      &.selected {
        border-color: $themeColor;
      }

      img {
        width: 100%;
      }
    }
  }
  .btns {
    display: flex;
    justify-content: center;
    align-items: center;

    .btn {
      width: 120px;
      margin: 0 5px;
    }
  }
}
.configs {
  margin-top: 5px;
  display: flex;
  justify-content: space-between;

  .items {
    display: flex;
  }
  .item {
    margin-right: 5px;
  }
}
.recommends {
  display: flex;
  flex-wrap: wrap;
  margin-top: 10px;

  .recommend {
    font-size: 12px;
    background-color: #f1f1f1;
    border-radius: $borderRadius;
    padding: 3px 5px;
    margin-right: 5px;
    margin-top: 5px;
    cursor: pointer;

    &:hover {
      color: $themeColor;
    }
  }
}
.model-selector {
  margin-top: 10px;
  font-size: 13px;
  display: flex;
  align-items: center;
}
.count {
  font-size: 12px;
  color: #999;
  margin-right: 10px;
}
.language {
  font-size: 12px;
  margin-right: 10px;
  color: $themeColor;
  cursor: pointer;
}
.submit {
  height: 20px;
  font-size: 12px;
  background-color: $themeColor;
  color: #fff;
  display: flex;
  align-items: center;
  padding: 0 5px;
  border-radius: $borderRadius;
  cursor: pointer;

  &:hover {
    background-color: $themeHoverColor;
  }

  .icon {
    font-size: 15px;
    margin-right: 3px;
  }
}
</style>