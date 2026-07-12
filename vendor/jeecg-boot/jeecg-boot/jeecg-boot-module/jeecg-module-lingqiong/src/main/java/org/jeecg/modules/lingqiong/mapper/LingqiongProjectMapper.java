package org.jeecg.modules.lingqiong.mapper;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.jeecg.modules.lingqiong.entity.LingqiongProject;

@Mapper
@DS("lingqiong")
public interface LingqiongProjectMapper extends BaseMapper<LingqiongProject> {
}
