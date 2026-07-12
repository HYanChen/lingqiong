package org.jeecg.modules.lingqiong.mapper;

import com.baomidou.dynamic.datasource.annotation.DS;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.jeecg.modules.lingqiong.entity.LingqiongFrontUser;

@Mapper
@DS("lingqiong")
public interface LingqiongFrontUserMapper extends BaseMapper<LingqiongFrontUser> {
}
